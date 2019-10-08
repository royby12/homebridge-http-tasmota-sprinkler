# homebridge-http-tasmota-sprinkler

This plugin create a Sprinkler/ Fuscet Object in Homekit. 
It rely on Tasmota Pulsetime function for the Timer (to reduce the dependency of shutdown by API).


JSON Config:

```
 {
    "accessory": "HttpSprinkler",
    "name": "Sprinkler backyard",
    "icon": 0,
    "timeout": 3000,
    "statusUrl": "http://[SONOFF_IP]",
    "useTimer": "yes"
 }
```


Inspiered by @goedh452. Based on:
https://github.com/goedh452/homebridge-http-sprinkler
