const getDatabase = require('../getDatabase');
const express = require('express')
const serverless = require('serverless-http');
const bodyParser = require('body-parser');
const app = express()

app.use(bodyParser.urlencoded({ extended: true })); 

app.post('/register', function (req, res) {
  getDatabase().then(db => {
    db.containers.createIfNotExists({ id: "notifications" }).then(containerResponse => {
      // TODO actuial verification and parsing out the body
      // TODO delete if no stores selected
      notification = req.body
      notification.id = req.body.email
      containerResponse.container.items.upsert(notification).then(item => {
        res.send("Success")
      });
    });
  });
})

// TODO email verification
module.exports.appHandler = serverless(app)
