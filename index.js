const express = require('express');
const amtrak = require('amtrak');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

app.use(cors({origin: '*'}));

app.get('/', async (req, res) => {
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
	res.send(final);
})

app.get('/v1/trains/ids', async (req, res) => {
	res.send(objectIDs);
})

app.get('/v1/trains', async (req, res) => {
	res.send(trains);
	console.log("Returned trains")
});

app.get('/v1/trains/:train', async (req, res) => {
	let train = req.params.train.replace('.json', '');
	res.send(trains[train]);
	console.log(`Returned train ${train}`)
});

app.get('/v1/stations', async (req, res) => {
	res.send(stations);
	console.log("Returned stations")
});

app.get('/v1/stations/:station', async (req, res) => {
	let station = req.params.station.replace('.json', '').toUpperCase();
	res.send(stations[station]);
	console.log(`Returned station ${station}`)
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

// variables the update script writes to and then copies to the above variables
var trainsNew = {};
var stationsNew = {};
var objectIDs = {};

const updateData = (async () => {
	console.log("updating trains")
	amtrak.fetchTrainData().then((trainsTemp) => {

		for (let i = 0; i < trainsTemp.length; i++) {

			let train_timely = "";
			let trainCurrent = trainsTemp[i];
			

			if (trainCurrent.statusMsg == null || trainCurrent.stations == null || (trainCurrent.trainState == 'Completed' && trainCurrent.origSchDep.valueOf() + 259200 < new Date().valueOf())) {
				continue;
			}

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

			/*
			if (trainCurrent.objectID == 860914) {
				trainCurrent.routeName = 'Horny MF Train'
			}

			if (trainCurrent.objectID == 863285) {
				trainCurrent.routeName = 'Horny MF Train 2.0'
			}
			*/

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
					"stationTimely": station_timely_parsed
				};

				trainCurrent.stations[j].stationTimely = station_timely_parsed;

				if (stationsNew[trainCurrent.stations[j]['code']] == undefined) {
					stationsNew[trainCurrent.stations[j]['code']] = [stationInd]
				} else {
					stationsNew[trainCurrent.stations[j]['code']].push(stationInd);
				}
			};

		};

		trains = trainsNew;
		stations = stationsNew;

		trainsNew = {};
		stationsNew = {};

		console.log("updated")
		//idk lol
		fetch('https://api.cloudflare.com/client/v4/zones?name=amtrak.cc&status=active', {
			headers: {
				'X-Auth-Email': 'piero@piemadd.com',
				'X-Auth-Key': process.env.cloudflare,
				'Content-Type': 'application/json'
			}
		})
		.then(async (res) => {
			let domainID = await res.json();
			fetch(`https://api.cloudflare.com/client/v4/zones/${domainID.result[0]['id']}/dns_records?type=CNAME&name=api.amtrak.cc`, {
				headers: {
					'X-Auth-Email': 'piero@piemadd.com',
					'X-Auth-Key': process.env.cloudflare,
					'Content-Type': 'application/json'
				}
			}).then(async (res) => {
				let result = await res.json()
				let recordID = result.result[0]['zone_id']

				fetch(`https://api.cloudflare.com/client/v4/zones/${recordID}/purge_cache`, {
					method: 'POST',
					headers: {
						'X-Auth-Email': 'piero@piemadd.com',
						'X-Auth-Key': process.env.cloudflare,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({"purge_everything":true})
				})
				.then(async (res) => {
					if (await res.status) {
						console.log("Cache purged")
					} else {
						console.log("ruh roh raggy, something fucked up with the cache")
					}
				})
			});
		})		
	});

});

updateData();

app.listen(8080, () => {
	console.log('server started');
});