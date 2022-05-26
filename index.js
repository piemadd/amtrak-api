// all of this code is terrible. do not try to replicate for your own sanity

const express = require('express');
const amtrak = require('amtrak');
const cors = require('cors');
const fetch = require('node-fetch');
const stationsList = require('./stations');
const fs = require('fs');
const { toXML } = require("jstoxml");

const { names } = require('./trainNames');

const app = express();

const embedTemplate = fs.readFileSync('./embed.html', {encoding:'utf8', flag:'r'});
const testTrain = JSON.parse(fs.readFileSync('./testTrain.json', {encoding:'utf8', flag:'r'}));

app.use(cors({origin: '*'}));

app.get('/assets', async (req, res) => {
    res.send('https://www.amtrak.com/content/dam/projects/dotcom/english/public/documents/corporate/businessplanning/Amtrak-Asset-Line-Plans-FY21-25.pdf')
})

app.get('/', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send("Go to /docs for the documentation and /v1 for data.");
});

app.get('/docs', async (req, res) => {
	res.redirect("https://amtrak.piemadd.com/")
})

app.get('/v1/', async (req, res) => {
	res.redirect('/v1/trains')
});

app.get('/v1/trains/keys', async (req, res) => {
	let final = {}
	Object.keys(trains).forEach((trainNum) => {
		final[trainNum] = trains[trainNum][0]['routeName']
	})
	res.set('Cache-Control', 'max-age=120');
	res.send(final);
})

app.get('/v1/stations/keys', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send(stationsList);
})

app.get('/v1/trains/ids', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send(objectIDs);
})

app.get('/v1/trains/dates', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send(departureDates);
})

app.get('/v1/trains', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send(trains);
	console.log("Returned trains")
});

app.get('/v1/trains/:train', async (req, res) => {
	let train = req.params.train.replace('.json', '');

    res.set('Cache-Control', 'max-age=120');
    
    if (parseInt(train) == 9999 && !trains[2003]) {
        res.send([testTrain])
    } else {
        res.send(trains[train]);
    }
	console.log(`Returned train ${train}`)
});

app.get('/v1/stations', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send(stations);
	console.log("Returned stations")
});

app.get('/v1/stations/:station', async (req, res) => {
	let station = req.params.station.replace('.json', '').toUpperCase();
	res.set('Cache-Control', 'max-age=120');
	res.send(stations[station]);
	console.log(`Returned station ${station}`)
});

app.get('/v2/oembed', async (req, res) => {
    if (!req.query.url) {
        res.status(400).send('Bad Request')
    } else if (req.query.url == '{amtrakerUrl}') {
        res.send("read the docs please lol")
    } else {
        let requestedURL = req.query.url;
        let trainProps = requestedURL.split('/trains/')[1].split('&')[0].split('?d=');
        
        let objectID = requestedURL.split('view.html?train=')[1];
        let trainNum = trainProps[0];
        let trainDate = trainProps[1];
        let currentTrain = {};
        
        if (trainNum == 9999) {
            currentTrain = testTrain;
        } else {
            currentTrain = trains[trainNum][0]
        }
        
        let response = {
        	"version": "1.0",
        	"type": "rich",
            "html": embedTemplate.replace("train_number_here", trainNum).replace("train_date_here", trainDate),
        	"width": 420,
        	"height": 660,
        	"title": `Amtraker: ${currentTrain.routeName}`,
        	"provider_name": "Amtraker",
        	"provider_url": "https://amtraker.com/"
        }
    	res.set('Cache-Control', 'max-age=120');
        if (req.query.xml == 'true') {
            res.set('Content-Type', 'text/xml');
            res.send(toXML({'oembed': response}));    
        } else {
            res.send(response);
        }
    	console.log(`Returned embed for train ${trainNum}`);
    }
})

app.get('/v2/dataFeedState', async (req, res) => {
	res.set('Cache-Control', 'max-age=120');
	res.send({
        timeSinceLastUpdate: timeSinceLastUpdate,
        isStale: dataFeedIsStale
    });
	console.log("Returned data feed status")
});

app.get('/update', async (req, res) => {
	if (req.headers['updatetoken'] == process.env['updateToken']) {
		console.log("Updating!")
		updateData();
		res.status(200).send("All good!")
	} else {
		console.log('fuck')
		res.status(403).send("Unauthenticated")
	};
});

// variables the API pulls from;
var trains = {};
var stations = {};
var departureDates = {};
var timeSinceLastUpdate = 0;
var dataFeedIsStale = false;

// variables the update script writes to and then copies to the above variables
var trainsNew = {};
var stationsNew = {};
var objectIDs = {};
var departureDatesNew = {};
var timesSinceLastUpdated = [];

const updateData = (async () => {
	console.log("updating trains")

    const now = new Date().getTime();
    
	amtrak.fetchTrainData().then((trainsTemp) => {

        console.log(trainsTemp.length)

		for (let i = 0; i < trainsTemp.length; i++) {

            if(trainsTemp[i].destCode != trainsTemp[i].eventCode) {
                timesSinceLastUpdated.push(now - trainsTemp[i].updatedAt.getTime())   
            }
            
			let train_timely = "";
			let trainCurrent = trainsTemp[i];

			if (trainCurrent.statusMsg == null || trainCurrent.stations == null || (trainCurrent.trainState == 'Completed' && trainCurrent.origSchDep.valueOf() + 259200 < new Date().valueOf())) {
				continue;
			}

            trainCurrent.routeName = names[trainCurrent.trainNum] ? names[trainCurrent.trainNum] : trainCurrent.routeName
            
			if (new Date(trainCurrent.origSchDep) > new Date()) {
				trainCurrent.trainState = 'Predeparture';
			}

			if (trainCurrent.trainState == 'Completed') {
				train_timely = "DONE";
			}

			if (trainCurrent.trainState == 'Predeparture') {
				trainCurrent.eventCode = trainCurrent.origCode
			}

			objectIDs[trainCurrent.objectID] = trainCurrent.trainNum;
            
            if (!departureDatesNew[trainCurrent.trainNum]) {
                departureDatesNew[trainCurrent.trainNum] = [];
            }

            departureDatesNew[trainCurrent.trainNum].push(trainCurrent.origSchDep);

            trainCurrent.eventName = stationsList[trainCurrent.eventCode];
            
			if (new Date(trainCurrent.origSchDep).getDate() == 0 && trainCurrent.trainNum == 50) {
                let trainCloned = JSON.parse(JSON.stringify(trainCurrent));
                trainCloned.routeName = "Piero Limited";
                trainCloned.trainNum = 2003;
                trainCloned.objectID = 123456;
                trainsNew[trainCloned['trainNum']] = [trainCloned];

                if (!departureDatesNew[trainCloned.trainNum]) {
                    departureDatesNew[trainCloned.trainNum] = [];
                }
    
                departureDatesNew[trainCloned.trainNum].push(trainCloned.origSchDep);
    
                objectIDs[trainCloned.objectID] = trainCloned.trainNum;
    
                for (let j = 0; j < trainCloned.stations.length; j++) {
                    let station_timely = trainCloned.stations[j].postCmnt || trainCloned.stations[j].estArrCmnt || "NONE"
                    
                    if (trainCloned.stations[j].code == trainCloned.eventCode && trainCloned.stations[j].estArrCmnt) {
                        train_timely = trainCloned.stations[j].estArrCmnt;
                        
                    } else if (trainCloned.stations[j].code == trainCloned.eventCode && !trainCloned.stations[j].estArrCmnt && trainCloned.stations[j].estDepCmnt) {
                        train_timely = trainCloned.stations[j].estDepCmnt;
                    } else if (trainCloned.stations[j].code == trainCloned.eventCode && !trainCloned.stations[j].estArrCmnt && !trainCloned.stations[j].estDepCmnt) {
                        train_timely = "NONE";
                    }
    
                    switch (train_timely.substring(train_timely.length - 4)) {
                        case "TIME":
                            trainCloned['trainTimely'] = "On Time"
                            break;
                        case "LATE":
                            trainCloned['trainTimely'] = "Late"
                            break;
                        case "ARLY":
                            trainCloned['trainTimely'] = "Early"
                            break;
                        case "NONE":
                            trainCloned['trainTimely'] = "No Data";
                            break;
                        case "DONE":
                            trainCloned['trainTimely'] = "Completed";
                            break;
                    }
    
                    let station_timely_parsed = '';
    
                    switch (station_timely.substring(station_timely.length - 4)) {
                        case "TIME":
                            station_timely_parsed = "On Time"
                            break;
                        case "LATE":
                            station_timely_parsed = "Late"
                            break;
                        case "ARLY":
                            station_timely_parsed = "Early"
                            break;
                        case "NONE":
                            station_timely_parsed = "No Data";
                            break;
                        case "DONE":
                            station_timely_parsed = "Completed";
                            break;
                    }
                    
                    trainCloned['stations'][j]['stationName'] = stationsList[trainCloned.stations[j]['code']];
                    
                    let stationInd = {
                        "stationName": trainCloned['stations'][j]['stationName'],
                        "trainNum": trainCloned['trainNum'],
                        "tz": trainCloned['stations'][j]['tz'],
                        "schArr": trainCloned['stations'][j]['schArr'],
                        "schDep": trainCloned['stations'][j]['schDep'],
                        "autoArr": trainCloned['stations'][j]['autoArr'],
                        "autoDep": trainCloned['stations'][j]['autoDep'],
                        "schMnt": trainCloned['stations'][j]['schMnt'],
                        "postArr": trainCloned['stations'][j]['postArr'],
                        "postDep": trainCloned['stations'][j]['postDep'],
                        "postCmnt": trainCloned['stations'][j]['postCmnt'],
                        "estArrCmnt": trainCloned['stations'][j]['estArrCmnt'],
                        "estDepCmnt": trainCloned['stations'][j]['estDepCmnt'],
                        "stationTimely": station_timely_parsed
                    };
    
                    trainCloned.stations[j].stationTimely = station_timely_parsed;
    
                    if (stationsNew[trainCloned.stations[j]['code']] == undefined) {
                        stationsNew[trainCloned.stations[j]['code']] = [stationInd]
                    } else {
                        stationsNew[trainCloned.stations[j]['code']].push(stationInd);
                    }
                };
            }

			if (trainsNew[trainCurrent['trainNum']] == undefined) {
				trainsNew[trainCurrent['trainNum']] = [trainCurrent];
			} else {
				trainsNew[trainCurrent['trainNum']].push(trainCurrent);
			};

			for (let j = 0; j < trainCurrent.stations.length; j++) {

				let station_timely = trainCurrent.stations[j].postCmnt || trainCurrent.stations[j].estArrCmnt || "NONE"
				
				if (trainCurrent.stations[j].code == trainCurrent.eventCode && trainCurrent.stations[j].estArrCmnt) {
					train_timely = trainCurrent.stations[j].estArrCmnt;
					
				} else if (trainCurrent.stations[j].code == trainCurrent.eventCode && !trainCurrent.stations[j].estArrCmnt && trainCurrent.stations[j].estDepCmnt) {
					train_timely = trainCurrent.stations[j].estDepCmnt;
				} else if (trainCurrent.stations[j].code == trainCurrent.eventCode && !trainCurrent.stations[j].estArrCmnt && !trainCurrent.stations[j].estDepCmnt) {
					train_timely = "NONE";
				}

				switch (train_timely.substring(train_timely.length - 4)) {
					case "TIME":
						trainCurrent['trainTimely'] = "On Time"
						break;
					case "LATE":
						trainCurrent['trainTimely'] = "Late"
						break;
					case "ARLY":
						trainCurrent['trainTimely'] = "Early"
						break;
					case "NONE":
						trainCurrent['trainTimely'] = "No Data";
						break;
					case "DONE":
						trainCurrent['trainTimely'] = "Completed";
						break;
				}

				let station_timely_parsed = '';

				switch (station_timely.substring(station_timely.length - 4)) {
					case "TIME":
						station_timely_parsed = "On Time"
						break;
					case "LATE":
						station_timely_parsed = "Late"
						break;
					case "ARLY":
						station_timely_parsed = "Early"
						break;
					case "NONE":
						station_timely_parsed = "No Data";
						break;
					case "DONE":
						station_timely_parsed = "Completed";
						break;
				}

                trainCurrent['stations'][j]['stationName'] = stationsList[trainCurrent.stations[j]['code']];

				let stationInd = {
					"trainNum": trainCurrent['trainNum'],
					"tz": trainCurrent['stations'][j]['tz'],
					"schArr": trainCurrent['stations'][j]['schArr'],
					"schDep": trainCurrent['stations'][j]['schDep'],
					"autoArr": trainCurrent['stations'][j]['autoArr'],
					"autoDep": trainCurrent['stations'][j]['autoDep'],
					"schMnt": trainCurrent['stations'][j]['schMnt'],
					"postArr": trainCurrent['stations'][j]['postArr'],
					"postDep": trainCurrent['stations'][j]['postDep'],
					"postCmnt": trainCurrent['stations'][j]['postCmnt'],
					"estArrCmnt": trainCurrent['stations'][j]['estArrCmnt'],
					"estDepCmnt": trainCurrent['stations'][j]['estDepCmnt'],
					"stationTimely": station_timely_parsed,
                    "stationName": stationsList[trainCurrent.stations[j]['code']]
				};

				trainCurrent.stations[j].stationTimely = station_timely_parsed;

				if (stationsNew[trainCurrent.stations[j]['code']] == undefined) {
					stationsNew[trainCurrent.stations[j]['code']] = [stationInd]
				} else {
					stationsNew[trainCurrent.stations[j]['code']].push(stationInd);
				}
			};
		};

        console.log("start counting")

        let timesTotalTemp = 0;
        for (let i = 0; i < timesSinceLastUpdated.length; i++) {
            timesTotalTemp += timesSinceLastUpdated[i];
        }

        console.log('end counting')
    
        timeSinceLastUpdate = parseInt(timesTotalTemp / timesSinceLastUpdated.length);

        dataFeedIsStale = timeSinceLastUpdate > 7200000;

        console.log('timings done')

        //trainsNew['9999'] = [testTrain];
        objectIDs['123456'] = '9999';

        departureDatesNew['9999'] = ['2000-01-01T00:00:00.000Z'];
        
		trains = trainsNew;
		stations = stationsNew;
        departureDates = departureDatesNew;

		trainsNew = {};
		stationsNew = {};
        departureDatesNew = {};
        timesSinceLastUpdated = [];

		console.log("updated")
	});

});

updateData();

app.listen(8080, () => {
	console.log('server started');
});