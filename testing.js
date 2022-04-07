            if (trainCurrent.objectID == 1093328) {
                let trainCloned = JSON.parse(JSON.stringify(trainCurrent));
                trainCloned.routeName = "The Piero Limited";
                trainCloned.trainNum = 2003;
                trainCloned.objectID = 123456;
                trainsNew[trainCloned['trainNum']] = [trainCloned];
    
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
    
                    let stationInd = {
                        "stationName": stations[trainCurrent.stations[j]['code']],
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