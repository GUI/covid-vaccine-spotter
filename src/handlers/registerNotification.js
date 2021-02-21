const getDatabase = require('../getDatabase');
const express = require('express')
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const app = express()
const sendEmail = require('../sendEmail')


app.use(bodyParser.urlencoded({ extended: true })); 

app.post('/register', function (req, res) {
  getDatabase().then(db => {
    db.containers.createIfNotExists({ id: "notifications" }).then(containerResponse => {
      // TODO actuial verification and parsing out the body
      // TODO delete if no stores selected
      let emailAddress = req.body.email

      let notification = req.body
      notification.id = emailAddress

      containerResponse.container.items.upsert(notification).then(itemResponse => {
        let sendPromise = null
        if (itemResponse.statusCode == 201){
          sendPromise = sendEmail(emailAddress,"Verify email address for covid vaccine notifications", `Click this link to confirm you would like to recieve covid vaccine notifications for the following stores.`)
        } else {
          sendPromise = sendEmail(emailAddress,"Your covid vaccine notification preferences have been updated.","More details")
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
    });
  });
})

app.get('/unregister', function (req, res) {
  getDatabase().then(db => {
    db.containers.createIfNotExists({ id: "notifications" }).then(containerResponse => {
      // TODO actuial verification and parsing out the body
      // TODO delete if no stores selected
      let emailAddress = req.query.email

      containerResponse.container.item(emailAddress).delete().then(() => {
        console.log(`Unsubscribing ${emailAddress}`)
        let sendPromise = sendEmail(emailAddress,"Unsubscribed from covid vaccine notifications", `You have been unsubscribed from covid vaccine notifications.`)
        
        // Handle promise's fulfilled/rejected states
        sendPromise.then(
          function(data) {
            console.log(data.MessageId);
            res.send("Success");
          }).catch(
            function(err) {
            console.error(err, err.stack);
            res.send("Success");
          });
      }).catch(
        function(err) {
          // Always send success, regardless of if the record was found and deleted
          console.error(err, err.stack);
          res.send("Success");
        }
      )
    });
  });
})

module.exports.appHandler = serverless(app)
