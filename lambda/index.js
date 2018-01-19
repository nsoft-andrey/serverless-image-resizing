'use strict';

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');
var crypto = require('crypto');

const BUCKET = process.env.BUCKET;
const URL = process.env.URL;
const SECRET_KEY = process.env.SECRET_KEY || "";

exports.handler = function(event, context, callback) {
  var key = event.queryStringParameters.key;
  var key_with_token = key.split('?t=');

    // TODO: add the cropping support
    // upscale - withoutEnlargement should be true

  if(key_with_token.length != 2) {
      return context.fail("Permissions denied");
  }

  key = key_with_token[0];
  const token = key_with_token[1];
  var match = key.match(/(\d+)x(\d+)\/(.*)/);
  var width, height, originalKey;

  if (match) {
    width = parseInt(match[1], 10);
    height = parseInt(match[2], 10);
    originalKey = match[3];
  }
  else {
    match = key.match(/(\d+)x\/(.*)/);
    if (match) {
      width = parseInt(match[1], 10);
      height = null;
    }
    else {
      match = key.match(/x(\d+)\/(.*)/);
      width = null;
      height = parseInt(match[1], 10);
    }
    originalKey = match[2];
  }

  const hash = crypto.createHmac('sha256', SECRET_KEY).update(originalKey).digest('hex');

      //.withoutEnlargement()
  if(token != hash) {
      return context.fail("Permissions denied");
  }

  S3.getObject({Bucket: BUCKET, Key: originalKey}).promise()
    .then(data => Sharp(data.Body)
      .resize(width, height)
      .toFormat('jpeg', {'quality': 90})
      .toBuffer()
    )
    .then(buffer => S3.putObject({
        Body: buffer,
        Bucket: BUCKET,
        ACL: 'public-read',
        ContentType: 'image/png',
        Key: key,
      }).promise()
    )
    .then(() => callback(null, {
        statusCode: '301',
        headers: {'location': `${URL}/${key}`},
        body: '',
      })
    )
    .catch(err => callback(err))
}
