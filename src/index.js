/**
 * This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
 * The Intent Schema, Custom Slots, and Sample Utterances for this skill, as well as
 * testing instructions are located at http://amzn.to/1LzFrj6
 *
 * For additional samples, visit the Alexa Skills Kit Getting Started guide at
 * http://amzn.to/1LGWsLG
 */

var AlexaSkill = require('./AlexaSkill');
var fs = require('fs');
var cheerio = require('cheerio');
var request = require("request");

/**
 * App ID for the skill
 */
var APP_ID = undefined; //OPTIONAL: replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

var CountrySkill = function () {
    AlexaSkill.call(this, APP_ID);
};

CountrySkill.prototype = Object.create(AlexaSkill.prototype);
CountrySkill.prototype.constructor = CountrySkill;

CountrySkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    //console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

CountrySkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    //console.log("onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    handleNewFactRequest(response);
};

/**
 * Overridden to show that a subclass can override this function to teardown session state.
 */
CountrySkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    //console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

CountrySkill.prototype.intentHandlers = {
    "HelloWorldIntent": function (intent, session, response) {
        handleCountryRequest(intent,response);
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("You can say tell me more about a country, or, you can say exit... What can I help you with?", "What can I help you with?");
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

function handleCountryRequest(intent,response) {
    var country_input = intent.slots.Country.value;
    console.log("Requested country: ");
    console.log(country_input);

    // call helper function to get country information
    var safety_status = helper.getSafetyStatusForCountry(country_input);

    // Create speech output
    var speechOutput = "Here's more information about " + country_input + ". ";
    speechOutput += country_input + " is " + safety_status + ".";

    var vaccine_satus = helper.getNecessaryVaccinesForCountry(country_input, function(diseases) {
        if(diseases.length > 0){
            speechOutput += " You need the following vaccines before you go there: ";
            for (var i = 0; i < diseases.length; i++) {
                speechOutput += diseases[i] + ",";
            }
        }
        response.tell(speechOutput + ".");
    });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the SpaceGeek skill.
    var skill = new CountrySkill();
    skill.execute(event, context);
};

// --------------- Helper Functions  -----------------------

var helper = {

    // gives the user more information on their final choice
    giveDescription: function (context) {

        // get the speech for the child node
        var description = helper.getDescriptionForNode(context.attributes.currentNode);
        var message = description + ', ' + repeatWelcomeMessage;

        context.emit(':ask', message, message);
    },

    // logic to provide the responses to the yes or no responses to the main questions
    yesOrNo: function (context, reply) {

        // this is a question node so we need to see if the user picked yes or no
        var nextNodeId = helper.getNextNode(context.attributes.currentNode, reply);

        // error in node data
        if (nextNodeId == -1)
        {
            context.handler.state = states.STARTMODE;

            // the current node was not found in the nodes array
            // this is due to the current node in the nodes array having a yes / no node id for a node that does not exist
            context.emit(':tell', nodeNotFoundMessage, nodeNotFoundMessage);
        }

        // get the speech for the child node
        var message = helper.getSpeechForNode(nextNodeId);

        // have we made a decision
        if (helper.isAnswerNode(nextNodeId) === true) {

            // set the game state to description mode
            context.handler.state = states.DESCRIPTIONMODE;

            // append the play again prompt to the decision and speak it
            message = decisionMessage + ' ' + message + ' ,' + playAgainMessage;
        }

        // set the current node to next node we want to go to
        context.attributes.currentNode = nextNodeId;

        context.emit(':ask', message, message);
    },

    // gets the description for the given node id
    getDescriptionForNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                return nodes[i].description;
            }
        }
        return descriptionNotFoundMessage + nodeId;
    },

    // returns the speech for the provided node id
    getSpeechForNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                return nodes[i].message;
            }
        }
        return speechNotFoundMessage + nodeId;
    },

    // checks to see if this node is an choice node or a decision node
    isAnswerNode: function (nodeId) {

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                if (nodes[i].yes === 0 && nodes[i].no === 0) {
                    return true;
                }
            }
        }
        return false;
    },

    // gets the next node to traverse to based on the yes no response
    getNextNode: function (nodeId, yesNo) {
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].node == nodeId) {
                if (yesNo == "yes") {
                    return nodes[i].yes;
                }
                return nodes[i].no;
            }
        }
        // error condition, didnt find a matching node id. Cause will be a yes / no entry in the array but with no corrosponding array entry
        return -1;
    },

    // Recursively walks the node tree looking for nodes already visited
    // This method could be changed if you want to implement another type of checking mechanism
    // This should be run on debug builds only not production
    // returns false if node tree path does not contain any previously visited nodes, true if it finds one
    debugFunction_walkNode: function (nodeId) {

        // console.log("Walking node: " + nodeId);

        if( helper.isAnswerNode(nodeId) === true) {
            // found an answer node - this path to this node does not contain a previously visted node
            // so we will return without recursing further

            // console.log("Answer node found");
             return false;
        }

        // mark this question node as visited
        if( helper.debugFunction_AddToVisited(nodeId) === false)
        {
            // node was not added to the visited list as it already exists, this indicates a duplicate path in the tree
            return true;
        }

        // console.log("Recursing yes path");
        var yesNode = helper.getNextNode(nodeId, "yes");
        var duplicatePathHit = helper.debugFunction_walkNode(yesNode);

        if( duplicatePathHit === true){
            return true;
        }

        // console.log("Recursing no");
        var noNode = helper.getNextNode(nodeId, "no");
        duplicatePathHit = helper.debugFunction_walkNode(noNode);

        if( duplicatePathHit === true){
            return true;
        }

        // the paths below this node returned no duplicates
        return false;
    },

    // checks to see if this node has previously been visited
    // if it has it will be set to 1 in the array and we return false (exists)
    // if it hasnt we set it to 1 and return true (added)
    debugFunction_AddToVisited: function (nodeId) {

        if (visited[nodeId] === 1) {
            // node previously added - duplicate exists
            // console.log("Node was previously visited - duplicate detected");
            return false;
        }

        // was not found so add it as a visited node
        visited[nodeId] = 1;
        return true;
    },

    /**
     * returns the safety status for the given country as a string.
     */
    getSafetyStatusForCountry: function(country) {
        var safetyStates = {
            // Safety index of 80%+
            SAFE: "safe",
            // Safety index between 60% - 80%
            MODERATELY_SAFE: "moderately safe",
            // Safety index of 60%-
            UNSAFE: "unsafe",
        }

        var content = fs.readFileSync('UL_Safety_Index_Data/ULSafetyIndexData.csv', 'utf-8');
        var contentByCountry = content.split('\n');
        // Skip the table header by starting with index 1
        for (var i = 1; i < contentByCountry.length; i++) {
            var countryData = contentByCountry[i].split(',');
            if(countryData[1] === country){
                // 6 is the index where ul_safety_index resides
                if (countryData[6] > 80) {
                    return safetyStates.SAFE;
                } else if (countryData[6] > 60) {
                    return safetyStates.MODERATELY_SAFE;
                } else {
                    return safetyStates.UNSAFE;
                }
            }
        }

        return "undefined";
    },

    /** Gets the necessary vaccines for a given country.
     *  Calls the callbackfunction with an array of the discovered diseases.
     */
    getNecessaryVaccinesForCountry: function (country, callbackFunction) {
        // Scrape https://wwwnc.cdc.gov/travel/destinations/list
        // to find out which vaccines are needed for which countries
        // Scrape tutorial here: https://www.sitepoint.com/web-scraping-in-node-js/
        var prefix = 'https://wwwnc.cdc.gov/';
        request({
            uri: prefix + 'travel/destinations/list',
        }, function(error, response, body) {
            var $ = cheerio.load(body);
            var contentArea = cheerio.load($("#contentArea").html());
            var countryLinks = contentArea("a");
            // Skip the alphabet links by starting at index 25
            for (var i = 25; i < countryLinks.length; i++) {
                if(countryLinks[i].children[0].data === country) {
                    request({
                        uri: prefix + countryLinks[i].attribs.href,
                    }, function(error, response, body) {
                        var $ = cheerio.load(body);
                        var diseasesArea = cheerio.load($(".disease").html());
                        var diseases = diseasesArea(".group-head, .traveler-disease");
                        var diseasesToReturn = [];
                        for (var i = 0; i < diseases.length; i++) {
                            var disease = diseases[i];
                            // Skip everything after 'some travelers because we only want
                            // to return the most important diseases
                            if (disease.attribs.class === 'group-head') {
                                if (disease.children[1].children[0].data === 'Some travelers') {
                                    break;
                                }
                            } else if (disease.children[0].next.children[0].data !== 'Routine vaccines') {
                                diseasesToReturn.push(disease.children[0].next.children[0].data);
                            }
                        }
                        callbackFunction(diseasesToReturn);
                    });
                    return;
                }
            }
        });
    }
};