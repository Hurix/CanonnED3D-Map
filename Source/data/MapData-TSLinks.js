const API_ENDPOINT = `https://api.canonn.tech`;
const API_LIMIT = 1000;

const capi = axios.create({
	baseURL: API_ENDPOINT,
	headers: {
		'Content-Type': 'application/json',
		Accept: 'application/json',
	},
});

let sites = {
	tssites: [],
};

const go = async types => {
	const keys = Object.keys(types);
	return (await Promise.all(
		keys.map(type => getSites(type))
	)).reduce((acc, res, i) => {
		acc[keys[i]] = res;
		return acc;
	}, {});
};

const getSites = async type => {
	let records = [];
	let keepGoing = true;
	let API_START = 0;
	while (keepGoing) {
		let response = await reqSites(API_START, type);
		await records.push.apply(records, response.data);
		API_START += API_LIMIT;
		if (response.data.length < API_LIMIT) {
			keepGoing = false;
			return records;
		}
	}
};

const reqSites = async (API_START, type) => {

	let payload = await capi({
		url: `/${type}?_limit=${API_LIMIT}&_start=${API_START}`,
		method: 'get'
	});

	return payload;
};

var canonnEd3d_tslinks = {
	//Define Categories
	systemsData: {
		categories: {
			'Thargoid Structures - (TS)': {
				'201': {
					name: 'Active',
					color: '008000',
				},
				'202': {
					name: 'Inactive',
					color: '800000',
				}
			},
            'Thargoid Link Targets': {
                /*'10': {
                    name: 'Varati',
                    color: 'f5a142',
                },
                '20': {
                    name: 'Waypoint',
                    color: '42f557',
                },*/

                '30': {
                    name: 'Bubble',
                    color: 'FF6666',
                },
                '40': {
                    name: 'Thargoid Site',
                    color: '66ff66',
                },
                '60': {
                    name: 'Eagle Eye',
                    color: '6666ff',
                },
                '10': {
                    name: 'to be specified',
                    color: '666666',
                },
            },
		},
        systems: [],
        routes: [
            /* example data of the intention
            {
                cat: ["30"], 'points': [

                    { 's': 'Origin HIP 33386', 'label': 'Origin HIP 33386' },
                    { 's': 'Target1 HIP 39748', 'label': 'Target1 HIP 39748' },

                ], 'circle': false
            },
            {
                cat: ["40"], 'points': [

                    { 's': 'Origin HIP 33386', 'label': 'Origin HIP 33386' },
                    { 's': 'Target2 HIP 61595', 'label': 'Target2 HIP 61595' },

                ], 'circle': false
            },
            */
        ]
	},
	startcoords: [],
	formatSites: async function (data, resolvePromise) {
		sites = await go(data);

		let siteTypes = Object.keys(data);

		for (var i = 0; i < siteTypes.length; i++) {
			for (var d = 0; d < sites[siteTypes[i]].length; d++) {
				let siteData = sites[siteTypes[i]];
				if (siteData[d].system.systemName && siteData[d].system.systemName.replace(' ', '').length > 1) {
					var poiSite = {};
					poiSite['name'] = siteData[d].system.systemName;

					//Check Site Type and match categories
					if (siteData[d].status.status == 'Active') {
						poiSite['cat'] = [201];
					} else {
						poiSite['cat'] = [202];
					}
					poiSite['coords'] = {
						x: parseFloat(siteData[d].system.edsmCoordX),
						y: parseFloat(siteData[d].system.edsmCoordY),
						z: parseFloat(siteData[d].system.edsmCoordZ),
					};

					// We can then push the site to the object that stores all systems
					canonnEd3d_tslinks.systemsData.systems.push(poiSite);

				}
			}
		}
		document.getElementById("loading").style.display = "none";
		resolvePromise();
	},

	formatLinks: function (data) {
        
        //adding sites to our list that are not thargoid sites but targeted by their links
        //the loops should be like 3*260*260 iterations; but actually much less because many targets are thargoid sites
        //i am sure this can be done much faster but icba right now
		for (var i = 0; i < data.length; i++) {
			if (data[i].tar_name && data[i].tar_name.replace(' ', '').length > 1) {
                found = false;
                //search on our main systems storage that we add on, to prevent multiple additions of the same
                for (var si = 0; si < canonnEd3d_tslinks.systemsData.systems.length; si++) {
                    if (canonnEd3d_tslinks.systemsData.systems[si].name == data[i].tar_name) {
                        found = true;
                        break;
                    }
                }
                if (found) continue;

                //add target system if it hasn't been found
                var poiSite = {};
                poiSite['name'] = data[i].tar_name;
                if (data[i].tar_infos) {
                    poiSite['infos'] = data[i].tar_infos + '<br/><a href="https://www.edsm.net/en/system?systemName=' + data[i].tar_name + '">EDSM</a><br/><a href="https://tools.canonn.tech/Signals/?system=' + data[i].tar_name + '">Signals</a>';
                } else {
                    poiSite['infos'] = '<br/><a href="https://www.edsm.net/en/system?systemName=' + data[i].tar_name + '">EDSM</a><br/><a href="https://tools.canonn.tech/Signals/?system=' + data[i].tar_name + '">Signals</a>';
                }

                /*
                //Check Site Type from csv

                if (data[i].type == 'Bubble') {
                    poiSite['cat'] = [201];
                } else {
                    poiSite['cat'] = [202];
                }
                */
                poiSite['cat'] = [10];

                poiSite['coords'] = {
                    x: parseFloat(data[i].tar_x),
                    y: parseFloat(data[i].tar_y),
                    z: parseFloat(data[i].tar_z),
                };

                // We can then push the site to the object that stores all systems
                canonnEd3d_tslinks.systemsData.systems.push(poiSite);
            }
        }

        // adding the routes as 1:1 lines since I didnt see a way to have 1:m routes
        //the CSV data will be one line for each link, so 2-3 lines per thargoid site
		for (var i = 0; i < data.length; i++) {
			if (data[i].name && data[i].name.replace(' ', '').length > 1) {
                var route = {};
                /* example route:
                {
                    cat: ["30"], 'points': [
    
                        { 's': 'Origin HIP 33386', 'label': 'Origin HIP 33386' },
                        { 's': 'Target1 HIP 39748', 'label': 'Target1 HIP 39748' },
    
                    ], 'circle': false
                },*/
				
                route['cat'] = [20];
                route['points'] = [
                    { 's': data[i].name, 'label': data[i].name },
                    { 's': data[i].tar_name, 'label': data[i].tar_name }
                ];
                route['circle'] = false;

				// We can then push the site to the object that stores all systems
				canonnEd3d_tslinks.systemsData.routes.push(route);
			}
		}
	},
	
	parseCSVData: function (url, callBack, resolvePromise) {
		Papa.parse(url, {
			download: true,
			header: true,
			complete: function (results) {
				callBack(results.data);

				// after we called the callback
				// (which is synchronous, so we know it's safe here)
				// we can resolve the promise

				document.getElementById("loading").style.display = "none";
				resolvePromise();
			},
		});
	},


	init: function () {
		//Sites Data
 		var sites = new Promise(function (resolve, reject) {
			canonnEd3d_tslinks.formatSites(sites, resolve);
		});
        
        //Links Data
		var links = new Promise(function (resolve, reject) {
			canonnEd3d_tslinks.parseCSVData('data/csvCache/thargoid_links.csv', canonnEd3d_tslinks.formatLinks, resolve);
		});

		Promise.all([sites, links]).then(function () {
			Ed3d.init({
				container: 'edmap',
				json: canonnEd3d_tslinks.systemsData,
				withFullscreenToggle: false,
				withHudPanel: true,
				hudMultipleSelect: true,
				effectScaleSystem: [20, 500],
				startAnim: true,
				showGalaxyInfos: true,
				//setting camera to Merope and adjusting
				playerPos: [-78.59375, -149.625, -340.53125],
				cameraPos: [-78.59375 - 500, -149.625, -340.53125 - 500],
				systemColor: '#FF9D00',
			});
		});
	},
};
