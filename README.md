# homebridge-http-tasmota-sprinkler

This plugin rely on Tasmota Pulsetime function to reduce the dependency of shutdown by API


JSON Config:

'''
 {
    "accessory": "HttpSprinkler",
    "name": "Sprinkler backyard",
    "icon": 0,
    "timeout": 3000,
    "statusUrl": "http://192.168.1.140",
    "useTimer": "yes"
 }
'''


Credit to goedh452. Based on:
https://github.com/goedh452/homebridge-http-sprinkler
