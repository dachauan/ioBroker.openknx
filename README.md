![Logo](admin/openknx.png)
# ioBroker.openknx
=================

[![NPM version](http://img.shields.io/npm/v/iobroker.openknx.svg)](https://www.npmjs.com/package/iobroker.openknx)
[![Downloads](https://img.shields.io/npm/dm/iobroker.openknx.svg)](https://www.npmjs.com/package/iobroker.openknx)

[![NPM](https://nodei.co/npm/iobroker.openknx.png?downloads=true)](https://nodei.co/npm/iobroker.openknx/)

This adapter serves as a communication interface between Iobroker Object tree and a IP Gateway on the KNX bus.  
This adapter allows to generate the communication objects by importing of knxproj Files from ETS.  
All generated Communication Objects are initially configured readable and writeable.

# Installation of early versions
This is an early untested version  
Please make a good backup of all your data!  
Please do not test in critical environments

install in shell
    cd /opt/iobroker/node_modules  
    npm i iobroker.openknx  
    iobroker add openknx  
    npm i knx  

updates:
    npm i iobroker.openknx  
    iobroker upload openknx  

# GA import


# Compatibility
This adapter has its own namespace 'openknx'.
for existing applications, that are connected to knx signals of other knx adapters you can use the setting:
Override object path
to e.g. knx.0. A new project import will then store the data in this object tree space.
Objects are not compatible, remove them manually before the import and disable all other knx adapters.
Leave setting empty to use the adapters own namespace.

# log level


# Adapter setting Interface Description

    {
    "_id": "path.and.name.to.object",       //derieved from the KNX structure
    "type": "state",
    "common": {
        "desc": "Basetype: 1-bit value, Subtype: switch", //informative
        "min": 0,                                         //
        "max": 1,
        "name": "Aussen Melder Licht schalten",           //informative description
        "read": true,                                     //default this is set, if false incoming bus values are not updating the object
        "role": "",                                       //tbd
        "type": "boolean",                                //boolean, number, string, object
        "unit": "",                                       //informative, derived from dpt
        "write": true                                     //default true, if set change on object is triggering knx write, succ. write sets then ack flag to true
    },
    "native": {
        "address": "0/0/7",         //knx address
        "answer_groupValueResponse": false, //default false, if set to true adapter responds with value on GroupValue_Read
        "autoread": true,           //default true, adapter sends a GroupValue_read on start to sync its states
        "bitlength": 1,             //size ob knx data
        "dpt": "DPT1.001",          //DPT
        "encoding": {               //informative
        "0": "Off",
        "1": "On"
        },
        "force_encoding": "",       
        "signedness": "",
        "valuetype": "basic"        //composite means set via a specific object
    },
    "from": "system.adapter.openknx.0",
    "user": "system.user.admin",
    "ts": 1638913951639
    }


# Adapter communication Interface Description
handeled DPTs 1-21,232,237,238  

Unhandeled DPTs are written as raw buffers, the iterface is a sequencial string of hexadecimal number. For example write '0102feff' to send values 0x01 0x02 0xfe 0xff on the bus. 
Where number, see scaling.

Description of handeled DPTs

	javascript datatype	special values	range
DPT-1	boolean		false, true
DPT-2	object	{"priority":1 bit,"data":1 bit}	-
DPT-3	object	{"decr_incr":1 bit,"data":2 bit}	-
DPT-18	object	{"save_recall":0,"scenenumber":0}	
DPT-21	object	{"outofservice":0,"fault":0,"overridden":0,"inalarm":0,"alarmunack":0}	-
DPT-232	object	{red:0..255, green:0.255, blue:0.255}	-
DPT-237	object	{"address":0,"addresstype":0,"readresponse":0,"lampfailure":0,"ballastfailure":0,"convertorerror":0}	-
DPT-4	string		one character sent as 8-bit character
DPT-16	string		one character sent as 16-character string
DPT-5	number		8-bit unsigned value
DPT-5.001	number		0..100 [%] scaled to 1-byte
DPT-5.003	number		0..360 [°] scaled to 1-byte
DPT-6	number		8-bit signed -128..127
DPT-7	number		16-bit unsigned value
DPT-8	number		2-byte signed value -32768..32767
DPT-9	number		2-byte floating point value
DPT-14	number		4-byte floating point value
DPT-12	number		4-byte unsigned value
DPT-13	number		4-byte signed value
DPT-15	number		4-byte
DPT-17	number		1-byte
DPT-20	number		1-byte
DPT-238	number		1-byte
DPT-10	number for Date Object		-
DPT-11	number for Date Object		-
DPT-19	number for Date Object		-
rest	object	{0 .. }	-


Only time and date information is exchanged with KNX time based datatypes, e.g. DPT-19 has unsupported fields for signal quality  

Object send and receive values are of type boolean (eg DPT1), number (scaled, or unscaled), string.  
DPT 2 'expects a object {"priority":0,"data":1}' receive provides a strinified object of same type.  
Other joint DPTs have similar object notation.  
DPT19 expects a Number from a Date Object, Iobroker can not handle objects, fields of KNX ko that cannot be derived from timestamp are not implemented eg. quality flags

Date and time DPTs (DPT10, DPT11)  
Please have in mind that Javascript and KNX have very different base type for time and date. 
DPT10 is time (hh:mm:ss) plus "day of week". This concept is unavailable in JS, so you'll be getting/setting a regular Date Js object, but please remember you'll need to ignore the date, month and year. The exact same datagram that converts to "Mon, Jul 1st 12:34:56", will evaluate to a wildly different JS Date of "Mon, Jul 8th 12:34:56" one week later. Be warned! 
DPT11 is date (dd/mm/yyyy): the same applies for DPT11, you'll need to ignore the time part.


# Features
* import groupaddresses in XML format
* import knxprj (only tested with ets 5.7.4 file format) 

# Adapterconfiguration
After installing this adapter, open the adapter configuration. Fill in:

##### KNX Gateway IP
<IP of your KNX/Lan GW> with ipv4 format

##### Port
this is normally port 3671 of the gateway.

##### phys. EIB Adress
Fill in physical address of the gateway in the format 1/1/1.

##### Add only new Objects

##### Override object path
The adapter uses openknx.0 for first instance as default path for Iobroker objects.
If your existing installation has a lot of references to existing knx objects to an existing folder, then you can specify its location, for example knx.0.
This feature will be removed in future.

##### Upload configuration
1st In the ETS go to Group Addresses, select Export Grou Adresses
Select XML Output Format 
2nd upload your ETS Export XML in the adapter via the GA XML-Import dialog

After the successful import a message shows how much objects where recognized.
Press "save & close" or "save" to restart the adapter and take over the changes.
When starting, the adapter tries to read all GroupAdresses with have the autoread flag (default setting). This could take a while and can produce a higher load on your KNX-bus. This ensures that the adapter operates with up-to-date values from the start.
Autoread is done on the first connection with the knx bus after an adapter start or restart, not on every knx reconnection.

## Objects
In Objects the group adress tree like in your ETS project.

# Usage
If the adapter startet successfully your datapoints will be available for communication interaction.

## Datapoint Types
Wide DPT (datapoint type) support (DPT1 - DPT21, DPT232, DPT237, DPT238 supported)
Values of unhandeled DPTs can be written and read out in raw format.

# Special settings

# Known Problems
- sends write instead of response on GroupValue_Read
- knxprj file only tested from ETS 5.7.4
- IOBroker object role definition missing

# limitations
- three level group address are only supported

## Changelog
### 0.0.17
* raw value handling, can now write and receive ga of unsupported dpt
* setting onlyAddNewObjects fixed
* adapter restart after import

### 0.0.14
* import ga xml

### 0.0.12
* initial version


## License
will be changed

The CC-NC-BY License (CC-NC-BY)

THE WORK IS PROVIDED UNDER THE TERMS OF THIS CREATIVE
COMMONS PUBLIC LICENSE ("CCPL" OR "LICENSE"). THE WORK IS PROTECTED BY
COPYRIGHT AND/OR OTHER APPLICABLE LAW. ANY USE OF THE WORK OTHER THAN AS
AUTHORIZED UNDER THIS LICENSE OR COPYRIGHT LAW IS PROHIBITED.

BY EXERCISING ANY RIGHTS TO THE WORK PROVIDED HERE, YOU ACCEPT AND AGREE
TO BE BOUND BY THE TERMS OF THIS LICENSE. TO THE EXTENT THIS LICENSE MAY
BE CONSIDERED TO BE A CONTRACT, THE LICENSOR GRANTS YOU THE RIGHTS
CONTAINED HERE IN CONSIDERATION OF YOUR ACCEPTANCE OF SUCH TERMS AND
CONDITIONS.

Read full license text in [LICENSE](LICENSE)
#   o p e n k n x  
 