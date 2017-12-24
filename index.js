'use strict';

// Imports dependencies and set up http server
const express = require('express');
const bodyParser = require('body-parser');
const app = express().use(bodyParser.json()); // creates express http server
var path = require("path")
var mysql = require('mysql')
var request = require("request")
var fetch = require('node-fetch')

var con = mysql.createConnection({
    host: "chatdbinstance.cdye1p7zziwn.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "calvin1811",
    port: "3306",
    database: "ChatDB"
});

function createTables(){
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
}

function setUserSubs(){
	var query = "INSERT INTO USER_SUBS (name, playerID) VALUES ?"
	var values = [['TEST', 'TOR'], ['TEST', 'ATL']]
	
	con.query(query, [values], function(err, results, fields) {
		if (err) throw err;
		console.log("INSERTED " + results.affectedRows + " ROWS")
	});
}

function getUserTeams(callback){
	con.query("SELECT * FROM USER_SUBS where name = \'TEST\'", function(err, results, fields) {
		if (err) throw err;
		if (results.length > 0) {
			var userTeams = []
			
			for (var i = 0; i < results.length; i++){
				userTeams.push(results[i].playerID)
			}
			//console.log("Returned Rows: " + userTeams);
			//getGameScores(date, userTeams, gameList)
			//console.log(gameList)
			callback(userTeams)
		} else {
			console.log("NO ROWS RETRIEVED");
		}
	});
}

//Gets the scoreboard for games happening on the date specified in for YYYYMMDD
function getGameScores(date, teams, showAllGames, callback){
	fetch(`http://data.nba.net/data/10s/prod/v1/${date}/scoreboard.json`)
	.then(response => {
		response.json().then(json => {
			//console.log("Today's Scores: ")
			var gameScores = []
			for(var i = 0; i < json.games.length; i++){
				var hTeamCode = json.games[i].hTeam.triCode
				var aTeamCode = json.games[i].vTeam.triCode
				var homeTeamScore = ((json.games[i].hTeam.score.length == 0) ? 0 : parseInt(json.games[i].hTeam.score))
				var awayTeamScore = ((json.games[i].vTeam.score.length == 0) ? 0 : parseInt(json.games[i].vTeam.score))
				var isEndGame =  json.games[i].endTimeUTC
				
				if((teams.indexOf(hTeamCode) >= 0 || teams.indexOf(aTeamCode) >= 0) || (showAllGames == true)){
					var scoreLine;
					if(homeTeamScore > awayTeamScore){
						scoreLine = hTeamCode+ ": " + homeTeamScore + "  " +  aTeamCode + ": " + awayTeamScore
					} else {
						scoreLine = aTeamCode + ": " + awayTeamScore + "  " + hTeamCode + ": " + homeTeamScore
					}
					
					if(isEndGame !== undefined){
						scoreLine += "  FINAL"
					} else {
						if(json.games[i].period.current != 0 && json.games[i].clock.length != 0) {
							scoreLine += "  Q" + json.games[i].period.current + " " + json.games[i].clock
						} else if(json.games[i].period.isEndOfPeriod == true) {
							scoreLine += "  Q" + json.games[i].period.current + " END"
						}
					}
					gameScores.push(scoreLine)
				}
				//console.log(json.games[i])
			}
			//console.log(gameScores)
			callback(gameScores)
		});
	 }) .catch(error => {
		console.log(error);
	 });
}

function getPlayers(year, callback){
	fetch(`http://data.nba.net/data/10s/prod/v1/${year}/players.json`)
	.then(response => {
		response.json().then(json => {
			var playersName = []
			var playersId = []
			for(var i = 0; i <json.league.standard.length; i++){
				var player = (json.league.standard[i].firstName + " " + json.league.standard[i].lastName)
				
				if( player.toLowerCase() == 'James Harden'.toLowerCase() ||  player.toLowerCase() == 'Demar Derozan'.toLowerCase() ){
					var playersChosen = json.league.standard[i]
					//console.log(player)
					playersName.push(player)
					playersId.push(playersChosen.personId)
				}
			}
			callback(playersName, playersId)
		});
	 }) .catch(error => {
		console.log(error);
	 });
}

function getPlayerStats(playerId, playerName, callback) {	
	fetch(`http://data.nba.net/data/10s/prod/v1/2017/players/${playerId}_profile.json`)
	.then(response => {
		response.json().then(json => {
			var minPerGame = json.league.standard.stats.latest.mpg
			var pointsPerGame = json.league.standard.stats.latest.ppg
			var reboundsPerGame = json.league.standard.stats.latest.rpg
			var assistsPerGame = json.league.standard.stats.latest.apg
			

			var basicStatLine = playerName + " \n MPG: " + minPerGame + " PPG: " + pointsPerGame + " APG: " + assistsPerGame + " RPG: " + reboundsPerGame  + " \n"
			callback(basicStatLine)
		});
	}) .catch(error => {
		console.log(error);
	});
}

function getSelectedPlayersStats(callback) {
	getPlayers("2017", function(playerNames, playerIds){
		for(var i = 0; i < playerNames.length; i++){
			var statList = []
			getPlayerStats(playerIds[i], playerNames[i], function(stat) {
				statList.push(stat)
				if(playerNames.length == statList.length) {
					callback(statList)
				}
			});
		}
	});
}

app.use(express.static(path.join(__dirname, 'Regna')));

// Sets server port and logs message on success
app.listen(process.env.PORT || 9000, () => console.log('webhook is listening'));
app.get('/nbaPlayers', function(req, res) {
	getSelectedPlayersStats(function(stats){
		var statList = ''
		for(var i = 0; i < stats.length; i++){
			statList += stats[i]
		}
		console.log(statList)
	});
});

app.get('/nba', function(req, res) {
	var userGameList;
	getUserTeams(function(result) {
		console.log("User Teams: " + result)
		var showAllGames =  true ;
		var datetime = new Date();
		var date = datetime.getFullYear()+'' + (datetime.getMonth()+1) + '' + datetime.getDate()
				
		getGameScores(date, result, showAllGames, function(games){
			userGameList = games
			var gameListFormat
			for(var i = 0; i < userGameList.length; i++){
				if(i == 0){
					gameListFormat = "Game  #" + (i + 1) + ": " + userGameList[i]  + "\n"
				} else {
					gameListFormat += "Game  #" + (i + 1) + ": " + userGameList[i]  + "\n"
				}
			}
			console.log("Response text:" + gameListFormat)
		});
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
	var userGameList;
	var message = received_message.text;
	
	if(message) {
		if(message.toLowerCase().includes('stats')) {
			getSelectedPlayersStats(function(stats){
				var statList = ''
				for(var i = 0; i < stats.length; i++){
					statList += stats[i]
				}
				response = {
					"text": statList
				}
				callSendAPI(sender_psid, response) 
			});
		} else if(message.toLowerCase().includes('games')) {
			getUserTeams(function(result) {
				console.log("User Teams: " + result)
				var showAllGames = (message.toLowerCase().includes('all')) ? true : false;
				var datetime = new Date();
				var date = datetime.getFullYear()+'' + (datetime.getMonth()+1) + '' + datetime.getDate()
						
				getGameScores(date, result, showAllGames, function(games){
					//userGameList = games
					console.log(games)
					var gameListFormat
					for(var i = 0; i < games.length; i++){
						if(i == 0){
							gameListFormat = "Game  #" + (i + 1) + ": " + games[i]  + " \n"
						} else {
							gameListFormat += "Game  #" + (i + 1) + ": " + games[i]  + " \n"
						}
						console.log("Response text:" + gameListFormat)
					}
					response = {
						"text": gameListFormat
					}
					console.log("Final Response text:" + gameListFormat)
					callSendAPI(sender_psid, response) 
				});
			});
		} else {
			response = {
				"text": "You sent the message: " + received_message.text + ". Now send me an attachment!"
			}
			callSendAPI(sender_psid, response) 
		}
	}
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
    // Construct the message body
	
	console.log("SenderId: " + sender_psid)
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