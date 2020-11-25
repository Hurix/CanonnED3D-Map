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

const getSystemsEDSMSphere = async (systemName, min, max) => {    
    //console.log("EDSM Query: ", systemNames);
	let payload = await edsmapi({
		url: `/sphere-systems?systemName=${systemName}&minRadius=${min}&radius=${max}`,
        method: 'get'
	});

	return payload;
};

function union_arrays (x, y) {
    var obj = {};
    for (var i = x.length-1; i >= 0; -- i)
        obj[x[i]] = x[i];
    for (var i = y.length-1; i >= 0; -- i)
        obj[y[i]] = y[i];
    var res = []
    for (var k in obj) {
        if (obj.hasOwnProperty(k))  // <-- optional
        res.push(obj[k]);
    }
    return res;
}

var canonnEd3d_tslinks = {
    //Define Categories
    sitesByIDs: {},
	systemsData: {
		categories: {
			'Site Properties': {
				'10': {
					name: 'to be specified',
					color: '888888',
				},
			},
		}
        , systems: []
        , routes: []
	},
    startcoords: [],
    addPOI: (name, x, y, z, category) => {
        //add the site
        let poiSite = {};
        poiSite['name'] = name;
        //console.log(category);
        //todo Check Site Type and match categories
        poiSite['cat'] = category;
        poiSite['coords'] = {
            x: parseFloat(x),
            y: parseFloat(y),
            z: parseFloat(z),
        };
        canonnEd3d_tslinks.systemsData.systems.push(poiSite);
    },

    trilaterate: async (data) => {
        var shells = [];
        for (index in data) {
            let bubble = data[index];
            let response = await getSystemsEDSMSphere(bubble.name, bubble.distanceMin, bubble.distanceMax)
            if (response.data.length<=0)
                console.log("EDSM call fail: ", response);
            shells.push(response.data);
        }
        //console.log("shells: ", shells);
        if(shells.length < 3) {
            console.log("sthn broke");
            return;
        }
        //console.log("shells: ", shells);
        var intersection = shells[0];
        //console.log("intersection: ", intersection);
        for (var i = 1; i < shells.length; i++) {
            //console.log("shells[i]: ", shells[i]);
            intersection = intersection.filter(x => {
                let shell = shells[i];
                let found = false;
                for (sysIndex in shell) {
                    let system = shell[sysIndex];
                    if (x.name == system.name) {
                        found = true;
                        break;
                    }
                }
                return found;
            });
            //console.log("intersection: ", intersection);
        }
        
        var intersectedSystems = [];
        for (key in intersection) {
            intersectedSystems.push(intersection[key].name);
        }

        console.log("Results: ", intersectedSystems);

        var response = await getSystemsEDSM(intersectedSystems);
        if (response.data.length<=0)
            console.log("EDSM call fail: ", response);
        for (key in response.data) {
            let system = response.data[key];
            canonnEd3d_tslinks.addPOI(
                system.name,
                system.coords.x,
                system.coords.y,
                system.coords.z,
                [10]
            );
        }
    },

	init: function () {
        var tssites = canonnEd3d_tslinks.trilaterate([
            {
                name: 'Pleiades Sector ih-v c2-16',
                distanceMin: '40',
                distanceMax: '41',
            },
            {
                name: 'Pleiades Sector ab-w b2-4',
                distanceMin: '53',
                distanceMax: '54',
            },
            {
                name: 'hip 15787',
                distanceMin: '33',
                distanceMax: '34',
            },
        ]);
        


        Promise.all([tssites]).then(function () {
            document.getElementById("loading").style.display = "none";  
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
