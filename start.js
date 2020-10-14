require('dotenv').config()

const { PubSub } = require('@google-cloud/pubsub')
const notifier = require('node-notifier')
const fs = require('fs')

const event = {
  doorbellChime: 'sdm.devices.events.DoorbellChime.Chime',
}

const pubSubClient = new PubSub()
const subscription = pubSubClient.subscription(process.env.SUBSCRIPTION_NAME)

const messageHandler = async message => {
  const data = JSON.parse(`${message.data}`)
  if (data.resourceUpdate.events[event.doorbellChime]) {
    const image = await fetch({
      method: 'POST',
      url: `${data.resourceUpdate.name}:executeCommand`,
      body: JSON.stringify({
        command: 'sdm.devices.commands.CameraEventImage.GenerateImage',
        params: {
          eventId: data.resourceUpdate.events[event.doorbellChime].eventId,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      }
    })
    notifier.notify({
      title: 'Nest Notify',
      message: 'There is someone at the door',
      sound: `${__dirname}/doorbell.mp3`,
      contentImage: image.results.url,
    })
  }
  message.ack()
}

subscription.on('message', messageHandler)
