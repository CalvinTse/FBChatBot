'use strict';

// Imports dependencies and set up http server
const express = require('express');
const bodyParser = require('body-parser');
const app = express().use(bodyParser.json()); // creates express http server
var path = require("path")
var mysql = require('mysql')
var request = require("request")
var nba = require('nba')
var fetch = require('node-fetch')

var con = mysql.createConnection({
    host: "chatdbinstance.cdye1p7zziwn.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "calvin1811",
    port: "3306",
    database: "ChatDB"
});

function getUserInfo(){
	con.connect(function(err) {
		if (err) throw err;
		console.log("Connected!");
	});

	con.query("SHOW TABLES LIKE \'USER_SUBS\'", function(err, results, fields) {
		if (err) throw err;
		if (results.length == 1) {
			console.log("TABLE EXISTS")
		} else {
			var sql = "CREATE TABLE USER_SUBS (name VARCHAR(255), playerID VARCHAR(255))";
			con.query(sql, function(errCreate, result) {
				if (errCreate) throw errCreate;
				console.log("Table created");
			});
		}
	});

	con.end(function(err) {
		if (err) throw err;
		console.log("Closed Connection")
	});

}


app.use(express.static(path.join(__dirname, 'Regna')));

// Sets server port and logs message on success
app.listen(process.env.PORT || 9000, () => console.log('webhook is listening'));

app.get('/nba', function(req, res) {
	//getUserInfo()
    var player = nba.findPlayer("Kyle Lowry");
    var jsonReturn
    //console.log(player)
    /*nba.stats.playerSplits({
        PlayerID: player.playerId,
        Season: '2017-18',
		LastNGames: '1'
    }).then(r => console.log(r.overallPlayerDashboard[0]));*/
	fetch("http://data.nba.net/data/10s/prod/v1/20171215/scoreboard.json")
	//fetch("https://maps.googleapis.com/maps/api/geocode/json?address=Florence")
	.then(response => {
		response.json().then(json => {
		  console.log(json.games[0]);
		});
	 }) .catch(error => {
		console.log(error);
	 });
});

app.get('/', function(req, res) {
    //console.log("HELLO")
    res.render("index.html")
});

//app.use('/Regna', express.static(__dirname + '/Regna'));
// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
            let webhookEvent = entry.messaging[0];
            console.log(webhookEvent);

            //Gets the sender PSID
            let sender_psid = webhookEvent.sender.id;
            console.log('Sender PSID: ' + sender_psid);

            if (webhookEvent.message) {
                handleMessage(sender_psid, webhookEvent.message);
            }
        });

        // Returns a '200 OK' response to all requests
        res.status(200).send('EVENT_RECEIVED');
    } else {
        // Returns a '404 Not Found' if event is not from a page subscription
        res.sendStatus(404);
    }

});

// Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

    // Your verify token. Should be a random string.
    let VERIFY_TOKEN = "TOKEN_123456789"

    // Parse the query params
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    // Checks if a token and mode is in the query string of the request
    if (mode && token) {

        // Checks the mode and token sent is correct
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {

            // Responds with the challenge token from the request
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);

        } else {
            // Responds with '403 Forbidden' if verify tokens do not match
            res.sendStatus(403);
        }
    }
});


// Handles messages events
function handleMessage(sender_psid, received_message) {
    let response;

    // Checks if the message contains text
    if (received_message.text) {
        // Create the payload for a basic text message, which
        // will be added to the body of our request to the Send API
        response = {
            "text": "You sent the message: " + received_message.text + ". Now send me an attachment!"
        }
    }
    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
    let request_body = {
        "recipient": {
            "id": sender_psid
        },
        "message": response
    }

    // Send the HTTP request to the Messenger Platform
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": {
            "access_token": "EAACSGKoj1PkBALlvGcLdgvERHXkq1PdC3ZBAUZB5w08yiq36X6ywqlwoBupYwPTR6jLXeIZCMltUZA6za7zKbZBiFf6RJgXF0Izdc0yPZBKqZCWZB5am8kjdy7qHrl3Jv4EPIaWre50vIwL4pdixBnkUUIZBIEZCwYNjuMRU3QaVZAFlOHRNEdohI4C"
        },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if (!err) {
            console.log('message sent!')
        } else {
            console.error("Unable to send message:" + err);
        }
    });
}