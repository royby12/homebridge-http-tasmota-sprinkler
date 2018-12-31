var Service, Characteristic;
var request = require("request");


module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-http-sprinkler", "HttpSprinkler", HttpSprinkler);
};

function HttpSprinkler(log, config) {
	this.log = log;
	
	// Get config info
	this.name				= config["name"]          	|| "HTTP Sprinkler";
	this.icon				= config["icon"]			|| 0
	this.timeout            = config["timeout"]         || 5000;
	this.statusUrl          = config["statusUrl"];
	this.useTimer			= config["useTimer"]		|| "no";

}

HttpSprinkler.prototype = {

	httpRequest: function (url, body, method, callback) {
		var callbackMethod = callback;
		
		request({
			url: url,
			body: body,
			method: method,
			timeout: this.timeout,
			rejectUnauthorized: false
			},
			function (error, response, responseBody) 
			{
				if (callbackMethod) 
				{
					callbackMethod(error, response, responseBody)
				}
				else 
				{
					//this.log("callbackMethod not defined!");
				}
			})
	},	

	getPowerState: function (callback) {
		if (!this.statusUrl) 
		{
			this.log("Ignoring request: Missing status properties in config.json.");
			callback(new Error("No status url defined."));
			return;
		}

		var url = this.statusUrl;
				
		this.httpRequest(url + "/cm?cmnd=status", "", "GET", function (error, response, responseBody) 
		{
			if (error) 
			{
				this.log('HTTP get status function failed: %s', error.message);
				callback(error);
			}
			else 
			{
				var powerOn = false;
				var json = JSON.parse(responseBody);
				var status = json.Status.Power;
				
				if (status != 0) 
				{
					powerOn = 1;
					this.log("Power state is currently ON");
				}
				else 
				{
					powerOn = 0;
					this.log("Power state is currently OFF");
				}
				
				this.valveService.getCharacteristic(Characteristic.Active).updateValue(powerOn);
				this.valveService.getCharacteristic(Characteristic.InUse).updateValue(powerOn);
				callback();
			}
		}.bind(this));
	},
	
	setPowerState: function (powerOn, callback) {
		var url;
		var body;
		var inuse;
		
		var that = this;
		
		if (powerOn) 
		{
			url = this.statusUrl+"/cm?cmnd=Power%20On";
			inuse = 1;
			this.log("Setting power state to ON");
		} 
		else 
		{
			url = this.statusUrl+"/cm?cmnd=Power%20Off";
			inuse = 0;
			this.log("Setting power state to OFF");
		}
		
		this.httpRequest(url, "", "GET", function (error, response, body)
		{
			if (error)
			{
				that.log("HTTP set status function failed %s", error.message);
			} 
		}.bind(this))	

		this.valveService.getCharacteristic(Characteristic.InUse).updateValue(inuse);
		this.valveService.getCharacteristic(Characteristic.Active).updateValue(inuse);
		callback();	
	},

	getDurationTime: function(callback){
		
		var url = this.statusUrl;
		this.httpRequest(url + "/cm?cmnd=Pulsetime", "", "GET", function (error, response, responseBody) 
		{
			if (error) 
			{
				this.log('HTTP get status function failed: %s', error.message);
				callback(error);
			}
			else 
			{
				var Duration;
				var json = JSON.parse(responseBody);
				Duration = parseInt(json.PulseTime1.substring(0, json.PulseTime1.indexOf("(Active")));

				if (Duration < 112){
					Duration = Math.floor(Duration/10);
				}
				else
				{
					Duration = Duration - 100;
				}

				this.valveService.getCharacteristic(Characteristic.SetDuration).setValue(Duration);
				this.log("Duration time is: " + Duration + " seconds");
				callback();
			}
		}.bind(this));
	},

	setDurationTime: function(data, callback){
		
		var url = this.statusUrl;	
		var that = this;
		var time = data.newValue+100; //For Tasmota Pulsetime > 112 add 100
		
		var powerOn = this.valveService.getCharacteristic(Characteristic.InUse).value;

		this.log("Duration Time in now Set to: " + data.newValue + " seconds");
		
		if (powerOn)
		{
			this.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(time - 100);//Update remaining time if its On
			clearTimeout(this.valveService.timer); // clear the timer if it was used
			this.valveService.timer = setTimeout( ()=> 
				{
				this.log("Timeout ended counting");
				this.valveService.getCharacteristic(Characteristic.InUse).updateValue(0);
				this.valveService.getCharacteristic(Characteristic.Active).updateValue(0);
				}, (data.newValue*1000));
		}

		this.httpRequest(url + "/cm?cmnd=Pulsetime%20" + time, "", "GET", function (error, response, body)
			{
				if (error)
				{
					that.log("HTTP set status function failed %s", error.message);
				} 
			}.bind(this));
	},

	getRemainingTime: function(callback){
		
		var url = this.statusUrl;
		this.httpRequest(url + "/cm?cmnd=Pulsetime", "", "GET", function (error, response, responseBody) 
		{
			if (error) 
			{
				this.log('HTTP get status function failed: %s', error.message);
				callback(error);
			}
			else 
			{
				var Duration;
				var json = JSON.parse(responseBody);
				Remaining = parseInt(json.PulseTime1.substring(json.PulseTime1.indexOf("e")+2,json.PulseTime1.indexOf(")")));
				if (Remaining < 112){
					Remaining = Math.floor(Remaining/10);
				}
				else
				{
					Remaining = Remaining - 100;
				}

				this.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(Remaining);
				this.log("Remaining time is: " + Remaining + " seconds");
				callback();
			}
		}.bind(this));
	},	

	ChangedInUse: function(data, callback){
		//Trigger by InUse change
		this.valveService.getCharacteristic(Characteristic.InUse).updateValue(data.newValue);
		this.valveService.getCharacteristic(Characteristic.Active).updateValue(data.newValue);
		switch(data.newValue)
		{
			case 0:
			{
				this.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(0);
				clearTimeout(this.valveService.timer); // clear the timer if it was used
				this.log("Time out is cleared");
				break;
			}
			case 1:
			{
				var timer = this.valveService.getCharacteristic(Characteristic.SetDuration).value;
				this.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(timer);
				
				this.valveService.timer = setTimeout( ()=> 
				{
				this.log("Timeout ended counting");
				this.valveService.getCharacteristic(Characteristic.InUse).updateValue(0);
				this.valveService.getCharacteristic(Characteristic.Active).updateValue(0);
				}, (timer*1000));						
				break;
			}
		}
	},

	getServices: function (){
		var that = this;
		
		var informationService = new Service.AccessoryInformation();

		informationService
			.setCharacteristic(Characteristic.Manufacturer, "Sprinkler")
			.setCharacteristic(Characteristic.Model, "Sprinkler Model")
			.setCharacteristic(Characteristic.SerialNumber, "Sprinkler");

		this.valveService = new Service.Valve(this.name);
				
				this.valveService.getCharacteristic(Characteristic.ValveType).updateValue(this.icon);// Set The ICON
				this.valveService
					.getCharacteristic(Characteristic.Active)
					.on('set', this.setPowerState.bind(this))
					.on('get', this.getPowerState.bind(this));
				
		
		if (this.useTimer == "yes") 
		{
			this.valveService.addCharacteristic(Characteristic.SetDuration);
			this.valveService.addCharacteristic(Characteristic.RemainingDuration);

			//this.valveService.addCharacteristic(Characteristic.IsConfigured);
			
			this.valveService.getCharacteristic(Characteristic.SetDuration)
				.on('change', this.setDurationTime.bind(this))
				.on('get'   , this.getDurationTime.bind(this));
			
			this.valveService.getCharacteristic(Characteristic.RemainingDuration)
				.on('get', this.getRemainingTime.bind(this));

			this.valveService.getCharacteristic(Characteristic.InUse)
				.on('change', this.ChangedInUse.bind(this));

		}
		
		return [this.valveService];
	}
};