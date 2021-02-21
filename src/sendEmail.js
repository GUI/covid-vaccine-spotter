var AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-2' });

module.exports = function sendEmail(to, subject, body) {
  // Create sendEmail params 
  var params = {
    Destination: { /* required */
      ToAddresses: [to]
    },
    Message: { /* required */
      Body: { /* required */
        Text: {
          Charset: "UTF-8",
          Data: body
        }
      },
      Subject: {
        Charset: 'UTF-8',
        Data: subject
      }
    },
    //TODO Fix this email address
    Source: 'matt@knox.software', /* required */
  };
  return new AWS.SES({ apiVersion: '2010-12-01' }).sendEmail(params).promise();
}