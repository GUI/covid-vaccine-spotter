const getDatabase = require('../getDatabase');
const express = require('express')
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const app = express()
const sendEmail = require('../sendEmail')
const emailValidator = require('email-validator')


app.use(bodyParser.urlencoded({ extended: true })); 

app.post('/register', function (req, res) {
  getDatabase().then(db => {
    db.containers.createIfNotExists({ id: "notifications" }).then(containerResponse => {
      // SES and Cosmos both care about the casing, so lets always toLower it
      let emailAddress = req.body.email.toLowerCase()
      if(emailValidator.validate(emailAddress)){
        let notification = {}
        notification.email = emailAddress
        notification.walmartStores = req.body.walmartStores
        notification.walgreensStores = req.body.walgreensStores
        notification.krogerStores = req.body.krogerStores
        notification.albertsonsStores = req.body.albertsonsStores

        notification.id = emailAddress

        containerResponse.container.items.upsert(notification).then(itemResponse => {
          let sendPromise = null
          if (itemResponse.statusCode == 201){
            sendPromise = sendEmail(emailAddress,"You have signed up for covid vaccine appointment notifications.", 
            `You will be notified when any appointments become available at the pharmacies you selected.<br><br>
            To unsubscribe from these notifications, <a href="${process.env.APIGW_URL}/unregister?email=${emailAddress}">click here</a>.
            `
            )
          } else {
            sendPromise = sendEmail(emailAddress,"Your covid vaccine notification preferences have been updated.",
            `Your pharmacy selections have been updated for covid vaccine appointment notifications.<br><br>
            To unsubscribe from these notifications, <a href="${process.env.APIGW_URL}/unregister?email=${emailAddress}">click here</a>.
            `)
          }
          // Handle promise's fulfilled/rejected states
          sendPromise.then(
            function(data) {
              console.log(data.MessageId);
              res.send("Success");
            }).catch(
              function(err) {
                console.error(err, err.stack);
                res.send("Failed");
            });
       });
      } else {
        res.status(400).send("Invalid request.")
      }
    });
  });
})

app.get('/unregister', function (req, res) {
  getDatabase().then(db => {
    db.containers.createIfNotExists({ id: "notifications" }).then(containerResponse => {
      // SES and Cosmos both care about the casing, so lets always toLower it
      let emailAddress = req.query.email.toLowerCase()
      if(emailValidator.validate(emailAddress)){
        containerResponse.container.item(emailAddress).delete().then(() => {
          console.log(`Unsubscribing ${emailAddress}`)
          let sendPromise = sendEmail(emailAddress,"Unsubscribed from covid vaccine notifications", `You have been unsubscribed from covid vaccine appointmnent notifications.`)
          
          // Handle promise's fulfilled/rejected states
          sendPromise.then(
            function(data) {
              console.log(data.MessageId);
              res.send("Success");
            }).catch(
              function(err) {
              console.error(err, err.stack);
              res.send("Something went wrong!");
            });
        }).catch(
          function(err) {
            // Always send success, regardless of if the record was found and deleted
            console.error(err, err.stack);
            res.send("Success");
          }
        )
      } else {
        res.status(400).send("Invalid request.")
      }
    });
  });
})

module.exports.appHandler = serverless(app)
