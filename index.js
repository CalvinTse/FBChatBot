'use strict';

// Imports dependencies and set up http server
const express = require('express');
const bodyParser = require('body-parser');
const app = express().use(bodyParser.json()); // creates express http server
var path = require("path")
var mysql = require('mysql')
var request = require("request")
var fetch = require('node-fetch')
var moment = require('moment')
var timeZone = require('moment-timezone')

var con = mysql.createConnection({
    host: "*****************************************",
    user: "*******",
    password: "******",
    port: "*****",
    database: "******"
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

//Query DB to add user teams
function setUserSubs(addTeams){
	var query = "INSERT INTO USER_SUBS (name, playerID) VALUES ?"
	
	con.query(query, [addTeams], function(err, results, fields) {
		if (err) throw err;
		console.log("INSERTED " + results.affectedRows + " ROWS")
	});
}

//Query the deltion for user unsubscribe
function deleteUserSubs(senderId, deleteTeam){
	var query = `DELETE FROM USER_SUBS WHERE name = '${senderId}' AND playerID = '${deleteTeam}'`
	
	con.query(query, function(err, results, fields) {
		if (err) throw err;
		console.log(results.affectedRows + " ROWS Affected")
	});
}

//Query DB to get User Names
function getUserTeams(senderId, callback){
	var sqlQuery = `SELECT * FROM USER_SUBS where name = \'${senderId}\'`
	
	con.query(sqlQuery, function(err, results, fields) {
		var userTeams = []
		if (err) throw err;
		if (results.length > 0) {
			
			for (var i = 0; i < results.length; i++){
				userTeams.push(results[i].playerID)
			}
			//console.log("Returned Rows: " + userTeams);
			//getGameScores(date, userTeams, gameList)
			//console.log(gameList)
		} else {
			console.log("NO ROWS RETRIEVED");
		}
		callback(userTeams)
	});
}


//Get nba teams by name city and id
function getNbaTeams(year, callback){
	fetch(`http://data.nba.net/data/10s/prod/v1/${year}/teams.json`)
	.then(response => {
		response.json().then(json => {
			var teamCodes = []
			var teamCityNames = new Map()
			var teamNicknames = new Map()
			var teamId = []
			for(var i = 0; i <json.league.standard.length; i++){
				if(json.league.standard[i].isNBAFranchise == true){
					var team = json.league.standard[i]
					teamCodes.push(team.tricode)
					teamCityNames.set(team.city.toUpperCase().replace(/\s+/g, ""), team.tricode)
					teamNicknames.set(team.nickname.toUpperCase().replace(/\s+/g, ""), team.tricode)
					teamId.push(team.teamId)
				}
			}
			callback(teamCodes, teamCityNames, teamNicknames)
		});
	 }) .catch(error => {
		console.log(error);
	 });
}

//Handles the unsubscribe message 
function deleteUserTeams(senderId, userTeamsList, callback){
	getNbaTeams('2017', function(nbaTeamsCodes, nbaCities, nbaNicknames){
		getUserTeams(senderId, function(userTeams) {
			//var teamsToDelete= []
			var teamNameDeleted = []
			for(var i = 0 ; i < userTeamsList.length; i++){
				if(nbaTeamsCodes.indexOf(userTeamsList[i]) >= 0 || nbaCities.has(userTeamsList[i]) || nbaNicknames.has(userTeamsList[i])){
					if(userTeams.indexOf(userTeamsList[i]) >= 0 && teamNameDeleted.indexOf(userTeamsList[i]) < 0 && nbaTeamsCodes.indexOf(userTeamsList[i]) >= 0){
						console.log("DELETE THIS TEAM: " + userTeamsList[i])
						//teamsToDelete.push([senderId, userTeamsList[i]])
						teamNameDeleted.push(userTeamsList[i])
					}  else if(nbaCities.has(userTeamsList[i]) || nbaNicknames.has(userTeamsList[i])){
						var userTeamCode
						if(nbaCities.has(userTeamsList[i])) {
							userTeamCode = nbaCities.get(userTeamsList[i])
						} else if(nbaNicknames.has(userTeamsList[i])) {
							userTeamCode = nbaNicknames.get(userTeamsList[i])
						}
						if(userTeams.indexOf(userTeamCode) >= 0 && teamNameDeleted.indexOf(userTeamCode) < 0) {
							console.log("DELETE THIS TEAM: " + userTeamCode)
							teamNameDeleted.push(userTeamCode)
						} else {
							console.log(userTeamsList[i] + " does not exists")
						}
					} else {
						console.log("Team " + userTeamsList[i] +" is not subscribed")
					}
				} else {
					console.log("Error: Teams Does not exist in the NBA")
				}
			}

			if(teamNameDeleted.length > 0) {
				for(var i = 0; i < teamNameDeleted.length; i++){
					deleteUserSubs(senderId, teamNameDeleted[i]) 
				}
			} else {
				console.log("NO new teams added")
			}
			callback(teamNameDeleted)
		});
	});
}

//Handles the subcription to teams that the user specifies
function addUserTeams(senderId, userTeamsList, callback){
	getNbaTeams('2017', function(nbaTeamsCodes, nbaCities, nbaNicknames){
		getUserTeams(senderId, function(userTeams) {
			var teamsToAdd= []
			var teamNameAdded = []
			for(var i = 0 ; i < userTeamsList.length; i++){
				if(nbaTeamsCodes.indexOf(userTeamsList[i]) >= 0 || nbaCities.has(userTeamsList[i]) || nbaNicknames.has(userTeamsList[i])){
					if(userTeams.indexOf(userTeamsList[i]) < 0 && teamNameAdded.indexOf(userTeamsList[i]) < 0 && nbaTeamsCodes.indexOf(userTeamsList[i]) >= 0){
						teamsToAdd.push([senderId, userTeamsList[i]])
						teamNameAdded.push(userTeamsList[i])
					} else if(nbaCities.has(userTeamsList[i]) || nbaNicknames.has(userTeamsList[i])){
						var userTeamCode
						if(nbaCities.has(userTeamsList[i])) {
							userTeamCode = nbaCities.get(userTeamsList[i])
						} else if(nbaNicknames.has(userTeamsList[i])) {
							userTeamCode = nbaNicknames.get(userTeamsList[i])
						}
						if(userTeams.indexOf(userTeamCode) < 0 && teamNameAdded.indexOf(userTeamCode) < 0) {
							teamsToAdd.push([senderId, userTeamCode])
							teamNameAdded.push(userTeamCode)
						} else {
							console.log(userTeamsList[i] + " already exists")
						}
					} else {
						console.log(userTeamsList[i] + " already exists")
					}
				} else {
					console.log("Error: Teams Does not exist in the NBA")
				}
			}

			if(teamsToAdd.length > 0) {
				setUserSubs(teamsToAdd) 
			} else {
				console.log("NO new teams added")
			}
			callback(teamNameAdded)
		});
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
			}
			callback(gameScores)
		});
	 }) .catch(error => {
		console.log(error);
	 });
}
//Gets player ids and determines if the user specified player actually exists
function getPlayers(year, playersList, callback){
	fetch(`http://data.nba.net/data/10s/prod/v1/${year}/players.json`)
	.then(response => {
		response.json().then(json => {
			var playersName = []
			var playersId = []
			for(var i = 0; i <json.league.standard.length; i++){
				var player = (json.league.standard[i].firstName + " " + json.league.standard[i].lastName)
				if( playersList.indexOf(player.replace(" ", "").toLowerCase()) >= 0){
					var playersChosen = json.league.standard[i]
					//console.log(playersChosen)
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

//gets individual player stats by calling specfic endpoints
function getPlayerStats(playerId, playerName, callback) {	
	fetch(`http://data.nba.net/data/10s/prod/v1/2017/players/${playerId}_profile.json`)
	.then(response => {
		response.json().then(json => {
			var minPerGame = json.league.standard.stats.latest.mpg
			var pointsPerGame = json.league.standard.stats.latest.ppg
			var reboundsPerGame = json.league.standard.stats.latest.rpg
			var assistsPerGame = json.league.standard.stats.latest.apg
		
			var basicStatLine = playerName + ": \nMPG: " + minPerGame + " PPG: " + pointsPerGame + " APG: " + assistsPerGame + " RPG: " + reboundsPerGame  + " \n"
			callback(basicStatLine)
		});
	}) .catch(error => {
		console.log(error);
	});
}


//Gets the user stats specified by the user in a array
function getSelectedPlayersStats(playersList, callback) {
	var playerListLowerCase = []
	for(var i = 0;  i < playersList.length; i++){
		playerListLowerCase.push(playersList[i].toLowerCase())
	}
	getPlayers("2017", playerListLowerCase, function(playerNames, playerIds){
		var statList = []
		if(playerNames.length > 0){
			for(var i = 0; i < playerNames.length; i++){
				getPlayerStats(playerIds[i], playerNames[i], function(stat) {
					statList.push(stat)
					if(playerNames.length == statList.length) {
						callback(statList)
					}
				});
			}
		} else {
			callback(statList)
		}
	});
}


//Gets the Users first name if allowed for personlized communication
function getUserGreeting(senderId, callback) {
	fetch(`https://graph.facebook.com/v2.6/${senderId}?fields=first_name,last_name,profile_pic&access_token=EAACSGKoj1PkBALuryot7HFXqy9bGZCM6YTZC1pAIyRQX7vY1CtSnMtM49f97tvSCJiOuCQGk0q7sXQakVrl5LwvNZBCunu1AcG59yCNVIeGYkFbJPRjewKnXdRsWRbGNY4lkBPeWzvLCmoEWZAZCysZBtdG4R86BM6u4egfLIJZAklPE8xH9SZCA`)
	.then(response => {
		response.json().then(json => {
			console.log(json)
			if(json.first_name !== undefined) {
				callback("Hey " + json.first_name + "!")
			} else {
				callback("Hey There!")
			}
		});
	}) .catch(error => {
		console.log(error);
	});
}


////////////////////////Local Development Code////////////////////////////////////

app.use(express.static(path.join(__dirname, 'Regna')));

// Sets server port and loWgs message on success
app.listen(process.env.PORT || 9000, () => console.log('webhook is listening'));

app.get('/nbaPlayers', function(req, res) {
	//var playersList = ["@jamesharden", "@kyleLowry"]
	//var txt = "Find stats for @jamesharden and @kyleLowry and @stephenCurry"
	var txt = "Find stats for @lavarball"
	var playersFromTextList = txt.match(/@\w+/g)
	var playersList = []
	console.log(playersList)
	for(var i = 0; i < playersFromTextList.length; i++){
		playersList.push(playersFromTextList[i].substring(1))
	}
	console.log(playersList)
	getSelectedPlayersStats(playersList, function(stats){
		var statList = ''
		if(stats.length > 0){
			for(var i = 0; i < stats.length; i++){
				statList += stats[i]
			}
			console.log(statList)
		} else {
			console.log("EMPTY")
		}
	});
});

app.get('/nba', function(req, res) {
	var datetime = moment();	
	var date =  datetime.tz('America/New_York').subtract(1, 'days').format('YYYYMMDD')
	console.log("Moment Date: "+ datetime.tz('America/New_York').format('YYYYMMDD'))
});

app.get('/addNbaTeams', function(req, res) {
	var teamsToAdd = ["CHI", "TORONTO", "TOR", "BULLS"]
	addUserTeams("TEST1",teamsToAdd, function(teamsAdded) {
		if(teamsAdded.length > 0) {
			console.log("Added: " + teamsAdded)
		} else {
			console.log("No teams Added")
		}
	});
});

app.get('/deleteNbaTeams', function(req, res) {
var teamsToDelete = ["TORONTO", "TOR", "BULLS", "WARRIORS"]
	deleteUserTeams("TEST1", teamsToDelete, function(teamsAdded) {
		if(teamsAdded.length > 0) {
			console.log("Deleted: " + teamsAdded)
		} else {
			console.log("No teams Added")
		}
	});
});

app.get('/', function(req, res) {
    //console.log("HELLO")
    res.render("index.html")
});


//////////////////ENDPOINTS FOR MESSENGER APP///////////////////////////////////////

// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {

    let body = req.body;

    // Checks this is an event from a page subscription
    if (body.object === 'page') {

        // Iterates over each entry - there may be multiple if batched
        body.entry.forEach(function(entry) {

            // Gets the message. entry.messaging is an array, but 
            // will only ever contain one message, so we get index 0
			//console.log("webhookEvent " + entry.messaging);
			if(entry.messaging !== undefined) {
				let webhookEvent = entry.messaging[0];
				console.log(webhookEvent);

				//Gets the sender PSID
				let sender_psid = webhookEvent.sender.id;
				console.log('Sender PSID: ' + sender_psid);

					//Page id for postbacks
				if (webhookEvent.message && sender_psid !== '164855247442750') {
					//console.log('nlp: ' + webhookEvent.message.nlp.entities);
					handleMessage(sender_psid, webhookEvent.message);
				} else if (webhookEvent.postback) {
					handlePostback(sender_psid, webhookEvent.postback);
				}
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
	var GREET_USER = 0
	var SHOW_PLAYER_STATS = 1
	var SHOW_USER_TEAMS = 2 
	var SHOW_USER_GAMES = 3
	var SHOW_ALL_GAMES = 4
	var SUBSCRIBE_TEAMS = 5
	var UNSUBSCRIBE_TEAMS = 6
	var COMPARE_PLAYERS = 7
	var USER_THANKS = 8
	var NO_DECISION = 9
	
    let response;
	var userGameList;
	var message = received_message.text;
	var decisions = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
	var descisionMade = GREET_USER
	
	//Tokenizes the message and looks for specific keywords which will contribute to a score 
	//This will decide the response the user will get based on the highest score 
	if(message) {
		var messageTokenLowerCase = message.toLowerCase().match(/\w+/g)
		if(messageTokenLowerCase !== undefined) {
			for(var i = 0; i < messageTokenLowerCase.length; i++) {
				if(messageTokenLowerCase[i].includes('hello') || messageTokenLowerCase[i].includes('hey')) {
					decisions[GREET_USER] += 1
				} else if(messageTokenLowerCase[i].includes('stats')) {
					decisions[SHOW_PLAYER_STATS] += 3
				} else if (messageTokenLowerCase[i].includes('teams') || messageTokenLowerCase[i].includes('team')) {
					decisions[UNSUBSCRIBE_TEAMS] += 0.5
					decisions[SUBSCRIBE_TEAMS] += 0.5
					decisions[SHOW_USER_GAMES] += 0.5
					decisions[SHOW_ALL_GAMES] += 0.5
					decisions[SHOW_USER_TEAMS] += 1.5
				} else if (messageTokenLowerCase[i].includes('game') || messageTokenLowerCase[i].includes('score') ) {
					decisions[SHOW_USER_GAMES] += 1.5
					decisions[SHOW_ALL_GAMES] += 1.5
				} else if (messageTokenLowerCase[i].includes('subscribe')) {
					if (messageTokenLowerCase[i].includes('unsubscribe')) {
						decisions[UNSUBSCRIBE_TEAMS] += 3
					} else if(messageTokenLowerCase[i].includes('subscribed')) {
						decisions[SHOW_USER_TEAMS] += 1
					} else {
						decisions[SUBSCRIBE_TEAMS] += 3
					}
				} else if (messageTokenLowerCase[i].includes('my')) {
					decisions[SHOW_USER_TEAMS] += 1
					decisions[SHOW_USER_GAMES] += 1
				} else if (messageTokenLowerCase[i].includes('all')) {
					decisions[SHOW_ALL_GAMES] += 1.5
				} else if(messageTokenLowerCase[i].includes('today')) {
					decisions[SHOW_USER_GAMES] += 1
					decisions[SHOW_ALL_GAMES] += 1
				} else if(messageTokenLowerCase[i].includes('thank')) {
					decisions[USER_THANKS] += 1.5
				}
			}
		}
		
		var maxValue = decisions[0]
		for(var i = 0; i < decisions.length; i++){
			if(maxValue < decisions[i]) {
				maxValue = decisions[i]
				descisionMade = i
			}
		}
		if(descisionMade == GREET_USER && maxValue == 0) {
			descisionMade = NO_DECISION
		}
	}
	console.log("DESCISION: " + descisionMade)
	
	//Based on the decision the response will pass through a specfic method
	switch(descisionMade) {
		//For greeting and displaying instructions for user
		case GREET_USER:
			getUserGreeting(sender_psid, function(greeting) {
					response = {
						"attachment": {
							"type": "template",
							"payload": {
								"template_type": "generic",
								"elements": [{
									"title": greeting + " My name is LeStats",
									"subtitle": "I am here to give you updates on games and player stats from the NBA :D",
									"buttons": [
										{
											"type": "postback",
											"title": "How to Subcribe",
											"payload": "InstructSub",
										},
										{
											"type": "postback",
											"title": "How to Unsubcribe",
											"payload": "InstructUnsub",
										},
										{
											"type": "postback",
											"title": "How to check stats",
											"payload": "InstructStats",
										}
									],
								}]
							}
						}
					}
					callSendAPI(sender_psid, response); 
			});
			break
		
		//Shows the stats of the specfic players specified by the user
		case SHOW_PLAYER_STATS:
			var playersFromTextList = message.toLowerCase().match(/@\w+/g)
			var playersList = []
			console.log(playersList)
			if(playersFromTextList  !== null) {
				for(var i = 0; i < playersFromTextList.length; i++){
					playersList.push(playersFromTextList[i].substring(1))
				}
			}
			if(playersList.length > 0) {
				getSelectedPlayersStats(playersList, function(stats){
					if(stats.length > 0){
						var statList = ''
						for(var i = 0; i < stats.length; i++){
							statList += stats[i]
						}
						response = {
							"text": statList
						}
					} else {
						response = {
							"text": "I don't know this player's stats"
						}
					}
					
					callSendAPI(sender_psid, response) 
				});
			} else {
					response = {
						"text": "I dont understand, you did not specify any players. \nPlease reference players like this: \n@FirstNameLastName"
					}
					callSendAPI(sender_psid, response) 
			}
			break
		
		//Shows the teams that the user is subscribed to
		case SHOW_USER_TEAMS:
			getUserTeams(sender_psid, function(userTeams) {
				if(userTeams.length > 0) {
					response = {
						"text": "You are subscribed to " + userTeams
					}
				} else {
					response = {
						"text": "You arent subscribed to any teams right now.\nTo subscribe tell me to 'subscribe'  '@YourTeamName'"
					}
				}
				callSendAPI(sender_psid, response) 
			});
			break
			
		//Shows the games that thw user specifes	
		case SHOW_ALL_GAMES:
		case SHOW_USER_GAMES:
			var teamsFromTextList = message.toUpperCase().match(/@\w+/g)
			var teamsList = []
			console.log(teamsList)
			if(teamsFromTextList  !== null) {
				for(var i = 0; i < teamsFromTextList.length; i++){
					teamsList.push(teamsFromTextList[i].substring(1))
				}
			}
			
			if(teamsList.length == 0) {
				getUserTeams(sender_psid, function(result) {
					console.log("User Teams: " + result)
					var showAllGames = (descisionMade == SHOW_ALL_GAMES) ? true : false;
					var datetime = moment();
					var date
					
					if(message.toLowerCase().includes("yesterday")) {
						date =  datetime.tz('America/New_York').subtract(1, 'days')
					}	else if (message.toLowerCase().includes("tomorrow") || message.toLowerCase().includes("tmr")) {
						date =  datetime.tz('America/New_York').add(1, 'days')
					} else {
						date =  datetime.tz('America/New_York')
					}	
					
					console.log("Moment Date: "+ datetime.tz('America/New_York').format('YYYYMMDD'))
					console.log("showAllGames " + showAllGames)
					getGameScores(date.format('YYYYMMDD'), result, showAllGames, function(games){
						//userGameList = games
						console.log("Return games: "+ games)
						var gameListFormat
						for(var i = 0; i < games.length; i++){
							if(i == 0){
								gameListFormat = "Game  #" + (i + 1) + ": " + games[i]  + " \n"
								//gameListFormat = games[i]  + " \n"
							} else {
								gameListFormat += "Game  #" + (i + 1) + ": " + games[i]  + " \n"
								//gameListFormat += games[i]  + " \n"
							}
							//console.log("Response text:" + gameListFormat)
						}
						if(gameListFormat === undefined) {
							response = {
								"text": "No games to display"
							}
						} else {
							response = {
								"text": "The games I found for you that are happening on "+ date.format('MMMM Do YYYY') +" are: \n" + gameListFormat
							}
						}
						console.log("Final Response text:" + gameListFormat)
						callSendAPI(sender_psid, response) 
					});
				});
			} else {
				getNbaTeams('2017', function(nbaTeamsCodes, nbaCities, nbaNicknames){
					var teamGamesToSearch = []
					for(var i = 0; i < teamsList.length; i++) {
						if(nbaTeamsCodes.indexOf(teamsList[i]) >= 0 || nbaCities.has(teamsList[i]) || nbaNicknames.has(teamsList[i])){
							if(nbaTeamsCodes.indexOf(teamsList[i]) >= 0 && teamGamesToSearch.indexOf(teamsList[i]) < 0){
								teamGamesToSearch.push(teamsList[i])
							}else if(nbaCities.has(teamsList[i]) || nbaNicknames.has(teamsList[i])){
								var userTeamCode
								if(nbaCities.has(teamsList[i])) {
									userTeamCode = nbaCities.get(teamsList[i])
								} else if(nbaNicknames.has(teamsList[i])) {
									userTeamCode = nbaNicknames.get(teamsList[i])
								}
								if(teamGamesToSearch.indexOf(userTeamCode) < 0) {
									teamGamesToSearch.push(userTeamCode)
								}
							} 
						}
					}
					
					var datetime = moment();	
					var date
					
					if(message.toLowerCase().includes("yesterday")) {
						date =  datetime.tz('America/New_York').subtract(1, 'days')
					}	else if (message.toLowerCase().includes("tomorrow") || message.toLowerCase().includes("tmr")) {
						date =  datetime.tz('America/New_York').add(1, 'days')
					} else {
						date =  datetime.tz('America/New_York')
					}	
					
					console.log("Moment Date: "+ datetime.tz('America/New_York').format('YYYYMMDD'))
					getGameScores(date.format('YYYYMMDD'), teamGamesToSearch, false, function(games){
						//userGameList = games
						console.log("Return games: "+ games)
						var gameListFormat
						for(var i = 0; i < games.length; i++){
							if(i == 0){
								gameListFormat = "Game  #" + (i + 1) + ": " + games[i]  + " \n"
								//gameListFormat = games[i]  + " \n"
							} else {
								gameListFormat += "Game  #" + (i + 1) + ": " + games[i]  + " \n"
								//gameListFormat += games[i]  + " \n"
							}
							//console.log("Response text:" + gameListFormat)
						}
						if(gameListFormat === undefined) {
							response = {
								"text": "No games to display"
							}
						} else {
							response = {
								"text": "The games I found that are happening on "+ date.format('MMMM Do YYYY') +" are: \n" + gameListFormat
							}
						}
						console.log("Final Response text:" + gameListFormat)
						callSendAPI(sender_psid, response) 
					});
				});
			}
			break
		
		//Unsubscribes to the teams that the user specfies
		case UNSUBSCRIBE_TEAMS:
			var teamCodeFromTextList = message.toUpperCase().match(/@\w+/g)
			var teamList = []
			console.log(teamCodeFromTextList)
			if(teamCodeFromTextList !== null) {
				for(var i = 0; i < teamCodeFromTextList.length; i++){
					teamList.push(teamCodeFromTextList[i].substring(1))
				} 
			}
			if(teamList.length > 0){
				deleteUserTeams(sender_psid, teamList, function(teamsDeleted) {
					if(teamsDeleted.length > 0) {
						console.log("Deleted: " + teamsDeleted)
						response = {
							"text": teamsDeleted + " has been removed from your teams"
						} 
					} else {
						response = {
							"text": "No teams deleted for  " + teamList
						} 
					}
					callSendAPI(sender_psid, response) 
				});
			} else {
				response = {
					"text": "No teams were deleted from your subscribers List please put in format: @TeamCode(triCode)"
				} 
				callSendAPI(sender_psid, response) 
			}
			break
		
		//Subscribes to the team that the user specifies
		case SUBSCRIBE_TEAMS:
			var teamCodeFromTextList = message.toUpperCase().match(/@\w+/g)
			var teamList = []
			console.log(teamCodeFromTextList)
			if(teamCodeFromTextList !== null) {
				for(var i = 0; i < teamCodeFromTextList.length; i++){
					teamList.push(teamCodeFromTextList[i].substring(1))
				} 
			}
			if(teamList.length > 0){
				addUserTeams(sender_psid, teamList, function(teamsAdded) {
					if(teamsAdded.length > 0) {
						console.log("Added: " + teamsAdded)
						response = {
							"text": "You are now subscribed to " + teamsAdded + " for your teams"
						} 
					} else {
						response = {
							"text": "No teams added from " + teamList
						} 
					}
					callSendAPI(sender_psid, response) 
				});
			} else {
				response = {
					"text": "No teams retrieved from message please put in format: @TeamCode(triCode)"
				} 
				callSendAPI(sender_psid, response) 
			}
			break
			
		//Handles the response for a gratitude	
		case USER_THANKS:
			response = {
				"text": "Glad I can help! :D"
			}
			callSendAPI(sender_psid, response) 
			break
			
		//This will handle whatever it cannot get	
		case NO_DECISION:
			response = {
				"text": "I do not understand what you are trying to tell me :("
			}
			callSendAPI(sender_psid, response) 
			break
	}
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {
	  let response;
  
	  // Get the payload for the postback
	  let payload = received_postback.payload;

	  // Set the response based on the postback payload
	  if (payload === 'InstructSub') {
		response = { "text": "To Subscribe to teams that you would like to follow just tell \nme to 'subscribe' to any team using the '@' symbol \nFor example: Subscribe to @Raptors" }
	  } else if (payload === 'InstructUnsub') {
		response = { "text": "To Subscribe to teams that you would like to follow just tell \nme to 'unsubscribe' to any team using the '@' symbol \nFor example: Unsubscribe from @Cleveland" }
	  } else if (payload === 'InstructStats') {
		response = { "text": "To check this years stats for a certain player just ask me \nby giving me the player name with the '@' symbol \nFor example: 'Show me the stats for @LonzoBall'" }
	  }
	  callSendAPI(sender_psid, response);
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
            "access_token": "EAACSGKoj1PkBALuryot7HFXqy9bGZCM6YTZC1pAIyRQX7vY1CtSnMtM49f97tvSCJiOuCQGk0q7sXQakVrl5LwvNZBCunu1AcG59yCNVIeGYkFbJPRjewKnXdRsWRbGNY4lkBPeWzvLCmoEWZAZCysZBtdG4R86BM6u4egfLIJZAklPE8xH9SZCA"
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