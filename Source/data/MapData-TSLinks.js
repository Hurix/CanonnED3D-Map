const API_ENDPOINT = `https://api.canonn.tech`;
const EDSM_ENDPOINT = `https://www.edsm.net/api-v1`;
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

const edsmapi = axios.create({
    baseURL: EDSM_ENDPOINT,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
})

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

const reqSystemName = async (name) => {

	let payload = await capi({
		url: `/systems?systemName=${name}`,
		method: 'get'
	});

	return payload;
};

const getSystemEDSM = async (systemName) => {

	let payload = await edsmapi({
		url: `/systems?systemName=${systemName}&showCoordinates=1`,
		method: 'get'
	});

	return payload;
};

var canonnEd3d_tslinks = {
    //Define Categories
    sitesByIDs: {},
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
                    color: '003300',
                },
                '60': {
                    name: 'Eagle Eye',
                    color: '000033',
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
	formatSites: (data) => {
        /*
        //not using the extensive json data as it seems to be older than the csv export from the gooogle sheet
        //also if link target is not thargoid site, it will be "null" while the csv mentions the system name

        sites = await go(data);
        let siteTypes = Object.keys(data);
        */

        //create associative array with siteID as keys
		for (var i = 0; i < data.length; i++) {
            if (data[i].system && data[i].system.replace(' ', '').length > 1) {
                canonnEd3d_tslinks.sitesByIDs[data[i].siteID] = data[i];
            }
        }
        //run through list and add sites and links at once, requires associative array with siteID as keys
        Object.keys(canonnEd3d_tslinks.sitesByIDs).forEach(async function(key, index) {
            let siteData = this[key];
            //add the site
            let poiSite = {};
            poiSite['name'] = siteData.system;

            //Check Site Type and match categories
            if (siteData.status == '✔') {
                poiSite['cat'] = [201];
            } else {
                poiSite['cat'] = [202];
            }
            poiSite['coords'] = {
                x: parseFloat(siteData.galacticX),
                y: parseFloat(siteData.galacticY),
                z: parseFloat(siteData.galacticZ),
            };

            // We can then push the site to the object that stores all systems
            canonnEd3d_tslinks.systemsData.systems.push(poiSite);
            
            canonnEd3d_tslinks.addRoute(siteData.system, siteData.msg1);
            canonnEd3d_tslinks.addRoute(siteData.system, siteData.msg2);
            canonnEd3d_tslinks.addRoute(siteData.system, siteData.msg3);

        }, canonnEd3d_tslinks.sitesByIDs)
    },
    
    addedSystems: {},
    fetchAddSystem: (name) => {
        if (canonnEd3d_tslinks.addedSystems[name]) return;
        getSystemEDSM(name).then(function(response) {
            for (var i = 0; i < response.data.length; i++) {
                
                let system = response.data[i];
                //add the site
                let poiSite = {};
                poiSite['name'] = system.name;

                //Check Site Type and match categories
                poiSite['cat'] = [10];
                poiSite['coords'] = {
                    x: parseFloat(system.coords.x),
                    y: parseFloat(system.coords.y),
                    z: parseFloat(system.coords.z),
                };
                canonnEd3d_tslinks.systemsData.systems.push(poiSite);
                canonnEd3d_tslinks.addedSystems[system.name] = true;
            }
        });
        
    },
    
    addRoute: (originSystem, msg) => {

        //add the route link
        if (msg && msg != 'X' && msg.replace(' ', '').length > 1) {
            let cat = [10];
            let tarname = msg;
            //if its not a thargoid structure, we need to add the system, too
            if ("TS" == msg.substr(0, 2)) {
                tarname = canonnEd3d_tslinks.sitesByIDs[msg].system;
                cat = [40];
            } else {
                canonnEd3d_tslinks.fetchAddSystem(msg);
            }

            var route = {};
            //todo 
            route['cat'] = cat;
            route['points'] = [
                { 's': originSystem, 'label': originSystem },
                { 's': tarname, 'label': tarname },
            ];
            route['circle'] = false;

            // We can then push the site to the object that stores all systems
            canonnEd3d_tslinks.systemsData.routes.push(route);
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
        //Links Data
		var links = new Promise(function (resolve, reject) {
			canonnEd3d_tslinks.parseCSVData('data/csvCache/202011052200_Canonn Universal Science DB - TS Export - Export CSV Data.csv', canonnEd3d_tslinks.formatSites, resolve);
		});

		Promise.resolve(links).then(function () {
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
