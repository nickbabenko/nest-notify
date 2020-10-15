require('dotenv').config()

const { PubSub } = require('@google-cloud/pubsub')
const notifier = require('node-notifier')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const { ClientCredentials, ResourceOwnerPassword, AuthorizationCode } = require('simple-oauth2')

const accessTokenFile = path.resolve(__dirname, 'accessToken.json')

const event = {
  doorbellChime: 'sdm.devices.events.DoorbellChime.Chime',
}

const pubSubClient = new PubSub()
const subscription = pubSubClient.subscription(process.env.SUBSCRIPTION_NAME)

const oauthConfig = {
  client: {
    id: process.env.OAUTH_CLIENT_ID,
    secret: process.env.OAUTH_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://www.googleapis.com/oauth2/v4',
  },
}

const oauthClient = new AuthorizationCode(oauthConfig)
let accessToken

const authenticate = async () => {
  accessToken = oauthClient.createToken(JSON.parse(fs.readFileSync(accessTokenFile)))

  if (accessToken.expired()) {
    try {
      accessToken = await accessToken.refresh({
        scope: 'https://www.googleapis.com/auth/sdm.service',
      })
    } catch (e) {
      console.log(`Access token refresh failed with error ${e}`)
      return
    }
  }

  subscribe()
}

const subscribe = () => {
  subscription.on('message', messageHandler)
}

const messageHandler = async message => {
  const data = JSON.parse(`${message.data}`)
  if (data.resourceUpdate
    && data.resourceUpdate.events
    && data.resourceUpdate.events[event.doorbellChime]) {
    try {
      const image = await (await fetch(`https://smartdevicemanagement.googleapis.com/v1/${data.resourceUpdate.name}:executeCommand`, {
        method: 'POST',
        body: JSON.stringify({
          command: 'sdm.devices.commands.CameraEventImage.GenerateImage',
          params: {
            eventId: data.resourceUpdate.events[event.doorbellChime].eventId,
          },
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken.token.access_token}`,
        }
      })).json()
      notifier.notify({
        title: 'Nest Notify',
        message: 'There is someone at the door',
        sound: `${__dirname}/doorbell.mp3`,
        contentImage: image.results.url,
      })
    } catch (e) {
      console.error(e)
    }
  }
  //message.ack()
}

authenticate()
