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

const getSystemsEDSM = async (systemNames) => {
    if (Array.isArray(systemNames)) {
        systemNames = "systemName[]="+systemNames.join("&systemName[]=");
    } else {
        systemNames = "systemName="+systemNames;
    }
    //console.log("EDSM Query: ", systemNames);
	let payload = await edsmapi({
		url: `/systems?showCoordinates=1&${systemNames}`,
        method: 'get'
	});

	return payload;
};

const getBubbleEDSM = async (x, y, z, r) => {
    //console.log("EDSM Query: ", x, y, z, r);
	let payload = await edsmapi({
		url: `/sphere-systems?showCoordinates=1&x=${x}&y=${y}&z=${z}&radius=${r}`,
        method: 'get'
	});

	return payload;
};

const recenterViewport = (center, distance) => {
    //-- Set new camera & target position
    Ed3d.playerPos = [center.x,center.y,center.z];
    Ed3d.cameraPos = [
      center.x + (Math.floor((Math.random() * 100) + 1)-50), //-- Add a small rotation effect
      center.y + distance,
      center.z - distance
    ];

    Action.moveInitalPosition();
}

var canonnEd3d_LandscapeSignal = {
    //Define Categories
    sitesByIDs: {},
	systemsData: {
		categories: {
            'Signal Strength': {
                '0': {
                    name: 'no signal',
                    color: '880000',
                },
                '1': {
                    name: 'barely a Tail',
                    color: '883300',
                },
                '2': {
                    name: 'Mountain, Tail, no Ridge',
                    color: '888800',
                },
                '3': {
                    name: 'barely full',
                    color: '338800',
                },
                '4': {
                    name: 'strong full landscape',
                    color: '008800',
                }
            },
            'System Type': {
                '10': {
                    name: 'to be specified',
                    color: '333333'
                },
                '20': {
                    name: 'Dataset',
                    color: '003300'
                }
            }
		}
        , systems: []
        , routes: []
	},
    startcoords: [],

    formatLandscapeStrengths: async (data) => {
        var edsmSearchQueue = new Set();
        //HostSystem,HostCoordinates,ObservedSystem,ObeservedCoordinates,SignalStrength
        //console.log("data", data);
        for (const key in data) {
            let connection = data[key];
            //acumulate system names to fetch and addPOI
            edsmSearchQueue.add(connection['HostSystem']);
            edsmSearchQueue.add(connection['ObservedSystem']);
            canonnEd3d_LandscapeSignal.addRoute(
                connection['HostSystem'],
                connection['ObservedSystem'],
                connection['SignalStrength'],
            );

        }

        return canonnEd3d_LandscapeSignal.fetchAddSystems(edsmSearchQueue);
    },

    fetchAddSystems: async (edsmSearchQueue)=>{
        //------------------------------------------------------------------------
        //-- math aspects shamelessly stolen from hud.class.js:250
        var center = null;
        var nbPoint = 0;
        var pointFar = null;

        //get known system
        let responseKnown = await getSystemsEDSM(Array.from(edsmSearchQueue));
        if (!responseKnown.data || responseKnown.data.length <= 0)
        {
            console.log("EDSM debug", responseKnown);
        }
        //console.log("responseKnown", responseKnown.data);
        for(const key in responseKnown.data) {
            let system = responseKnown.data[key];
            //add each system that is known in the data
            canonnEd3d_LandscapeSignal.addPOI(
                system.name,
                system.coords.x,
                system.coords.y,
                system.coords.z,
                ['20']
            );

            //-- Sum coords to detect the center & detect the most far point
            if(center == null) {
                center   = new THREE.Vector3(system.coords.x, system.coords.y, system.coords.z);
                pointFar = new THREE.Vector3(system.coords.x, system.coords.y, system.coords.z);
            } else {
                center.set(
                    (center.x + system.coords.x),
                    (center.y + system.coords.y),
                    (center.z + system.coords.z)
                );
                if(
                    (Math.abs(pointFar.x) - Math.abs(system.coords.x))+
                    (Math.abs(pointFar.y) - Math.abs(system.coords.y))+
                    (Math.abs(pointFar.z) - Math.abs(system.coords.z)) < 0
                ) {
                    pointFar.set(system.coords.x, system.coords.y, system.coords.z);
                }
            }
            nbPoint++;

        };

        if(nbPoint==0) return;

        //------------------------------------------------------------------------
        //-- Calc center of all selected points

        center.set(
            Math.round(center.x/nbPoint),
            Math.round(center.y/nbPoint),
            Math.round(center.z/nbPoint)
        );

        //-- Calc max distance from center of selection
        var distance = pointFar.distanceTo(center);

        //get surrounding Systems Bubble
        let responseBubble = await getBubbleEDSM(center.x, center.y, center.z, 4);
        if (!responseBubble.data || responseBubble.data.length <= 0)
        {
            console.log("EDSM debug", responseBubble);
        }
        //console.log("responseBubble", responseBubble.data);
        for (const index in responseBubble.data) {
            let system = responseBubble.data[index];
            canonnEd3d_LandscapeSignal.addPOI(
                system.name,
                system.coords.x,
                system.coords.y,
                system.coords.z,
                ['10']
            );
        }
    },

    addRoute: (originSystem, tarname, category) => {
        var route = {};
        if (parseInt(category) > 4) category = '4';
        if (category == '') category = '0';
        route['cat'] = [category];
        route['points'] = [
            { 's': originSystem.toUpperCase(), 'label': originSystem },
            { 's': tarname.toUpperCase(), 'label': tarname },
        ];
        route['circle'] = false;

        // We can then push the site to the object that stores all systems
        canonnEd3d_LandscapeSignal.systemsData.routes.push(route);
    },

    addPOI: (name, x, y, z, category) => {
        //add the site
        let poiSite = {};
        poiSite['name'] = name.toUpperCase();
        //console.log("adding poi:", name.toUpperCase());
        //console.log(category);
        //todo Check Site Type and match categories
        poiSite['cat'] = category;
        poiSite['coords'] = {
            x: parseFloat(x),
            y: parseFloat(y),
            z: parseFloat(z),
        };

        canonnEd3d_LandscapeSignal.systemsData.systems.push(poiSite);
    },

	parseCSVData: async (url, callBack) => {
        var parsePromise = new Promise(function (resolve, reject) {
            Papa.parse(url, {
                download: true,
                header: true,
                complete: resolve
            });
        });
        var results = await parsePromise;
        
        await callBack(results.data);

        // after we called the callback
        // (which is synchronous, so we know it's safe here)
        // we can resolve the promise

        document.getElementById("loading").style.display = "none";    
    },
    
	init: function () {
        var landscape = canonnEd3d_LandscapeSignal.parseCSVData(
            'data/csvCache/landscape_strengths.csv',
            canonnEd3d_LandscapeSignal.formatLandscapeStrengths
        );


        Promise.all([landscape]).then(function () {
			Ed3d.init({
				container: 'edmap',
				json: canonnEd3d_LandscapeSignal.systemsData,
				withFullscreenToggle: false,
				withHudPanel: true,
				hudMultipleSelect: true,
				effectScaleSystem: [20, 500],
				startAnim: true,
				showGalaxyInfos: true,
				//setting camera to Sagittarius A* and adjusting
				playerPos: [25.21875, -20.90625, 25899.96875],
				cameraPos: [25.21875-100, -20.90625, 25899.96875-100],
				systemColor: '#FF9D00',
            });
        });
	},
};
