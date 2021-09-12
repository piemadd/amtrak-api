const express = require('express');
const amtrak = require('amtrak');
const cors = require('cors');

const app = express();

app.use(cors({origin: '*'}));

app.get('/', async (req, res) => {
	res.send("Please use v1. Use /docs to see the docs.");
});

app.get('/docs', async (req, res) => {
	res.redirect("https://github.com/pieromqwerty/amtrak/blob/master/docs.md")
})

app.get('/v1/', async (req, res) => {
	res.redirect('/v1/trains')
});

app.get('/v1/trains.json', async (req, res) => {
	res.redirect('/v1/trains')
});

app.get('/v1/trains/keys', async (req, res) => {
	let final = {}
	Object.keys(trains).forEach((trainNum) => {
		final[trainNum] = trains[trainNum][0]['routeName']
	})
	res.send(final);
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

app.get('/v1/stations.json', async (req, res) => {
	res.redirect('/v1/stations')
});

app.get('/v1/stations/:station', async (req, res) => {
	let station = req.params.station.replace('.json', '');
	res.send(stations[station]);
	console.log(`Returned station ${station}`)
});

app.get('/update', async (req, res) => {
	if (req.headers['updateToken'] == process.env['updateToken']) {
		console.log("Updating!")
		updateData();
		res.status(200).send("All good!")
	} else {
		res.status(403).send("Unauthenticated")
	};
});

// variables the API pulls from;
var trains = {};
var stations = {};

// variables the update script writes to and then copies to the above variables
var trainsNew = {};
var stationsNew = {};

const updateData = (async () => {
	console.log("updating trains")
	amtrak.fetchTrainData().then((trainsTemp) => {
		for (let i = 0; i < trainsTemp.length; i++) {
			if (trainsNew[trainsTemp[i]['trainNum']] == undefined) {
				trainsNew[trainsTemp[i]['trainNum']] = [trainsTemp[i]];
			} else {
				trainsNew[trainsTemp[i]['trainNum']].push(trainsTemp[i]);
			};

			for (let j = 0; j < trainsTemp[i].stations.length; j++) {
				let stationInd = {
					"trainNum": trainsTemp[i]['trainNum'],
					"tz": trainsTemp[i]['stations'][j]['tz'],
					"schArr": trainsTemp[i]['stations'][j]['schArr'],
					"schDep": trainsTemp[i]['stations'][j]['schDep'],
					"autoArr": trainsTemp[i]['stations'][j]['autoArr'],
					"autoDep": trainsTemp[i]['stations'][j]['autoDep'],
					"schMnt": trainsTemp[i]['stations'][j]['schMnt'],
					"postArr": trainsTemp[i]['stations'][j]['postArr'],
					"postDep": trainsTemp[i]['stations'][j]['postDep'],
					"postCmnt": trainsTemp[i]['stations'][j]['postCmnt'],
					"estArrCmnt": trainsTemp[i]['stations'][j]['estArrCmnt'],
					"estDepCmnt": trainsTemp[i]['stations'][j]['estDepCmnt']
				};
				if (stationsNew[trainsTemp[i].stations[j]['code']] == undefined) {
					stationsNew[trainsTemp[i].stations[j]['code']] = [stationInd]
				} else {
					stationsNew[trainsTemp[i].stations[j]['code']].push(stationInd);
				}
			};
		};

		trains = trainsNew;
		stations = stationsNew;

		trainsNew = {};
		stationsNew = {};

		console.log("updated")
		
	});
});

updateData();

app.listen(8080, () => {
	console.log('server started');
});