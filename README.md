![Logo](admin/openknx.png)
# ioBroker.openknx

[![NPM version](http://img.shields.io/npm/v/iobroker.openknx.svg)](https://www.npmjs.com/package/iobroker.openknx)
[![Downloads](https://img.shields.io/npm/dm/iobroker.openknx.svg)](https://www.npmjs.com/package/iobroker.openknx)

[![NPM](https://nodei.co/npm/iobroker.openknx.png?downloads=true)](https://nodei.co/npm/iobroker.openknx/)


This adapter serves as communication interface between Iobroker and your KNX IP Gateway.
The adapter allows to generate the iobroker communication objects automatically by importing an ETS group address xml export.  
All generated communication objects are initially configured readable and writeable, values are fetched from the knx bus on adapter restart.

# Installation
This is an early untested version. Please make a good backup of all your data before installation! Please do not test in critical environments.

installation from shell

    cd /opt/iobroker/node_modules  
    npm i iobroker.openknx  
    iobroker add openknx  
    npm i knx  

updates

    npm i iobroker.openknx  
    iobroker upload openknx  

# Adapter configuration
![settings](docs/pictures/setting.png)
Press "save & close" or "save" to restart the adapter and take over the changes.
When starting, the adapter tries to read all GroupAdresses with have the autoread flag (default setting).
This could take a while and can produce a higher load on your KNX-bus. This ensures that the adapter operates with up-to-date values from the start.
Autoread is done on the first connection with the knx bus after an adapter start or restart, not on every knx reconnection.  
After adapter installation, open the adapter configuration. Fill in:
#### KNX Gateway IP
IP of your KNX/Lan GW

##### Port
this is normally port 3671 of the KNX IP gateway.

##### phys. EIB Adress
Fill in physical address of the gateway in the format 1/1/1.

##### Add only new Objects
If checked, the import will skip overwriting existing communication objects.

##### Override object path
The adapter uses openknx.0 for first instance as default path for Iobroker objects.
If your curent setup has a lot of references to existing knx objects to an existing folder, then you can specify its location, for example knx.0.
This feature will be removed in future.

#### GA XML import
1. In ETS go to Group Addresses, select export group addresse and select XML export in latest format version
2. upload your ETS Export XML in the adapter via the GA XML-Import dialog
3. Import will immediatelly start after file selection and give a status report after completion.  
After the successful import a message shows how much objects where recognized. More detailed information could be found in the log.

#### Frames per sec
This settings protects the KNX bus from data flooding by limiting data frames to a certain rate. Not sent frames are put into a fifo buffer.

# howto use the adapter & basic concept
todo

# Compatibility
This adapter has its own namespace 'openknx'.
for existing applications, that are connected to knx signals of other knx adapters you can use the setting:  
Override object path  
to e.g. knx.0. A new project import will then store the data in this object tree space.
Objects are not compatible, remove them manually before the import and disable all other knx adapters.
Leave setting empty to use the adapters own namespace.

# log level
Enable expert mode to enable switching between different log levels. Default loglevel is info.  
![loglevel](docs/pictures/logelevel.png)

# IOBroker Communication Object description

GA import generates a communication object folder structure following the ga main-group/middle-group scheme. Each groupaddress is an oject with following automatically generated data.

    {
    "_id": "path.and.name.to.object",                       //derieved from the KNX structure
    "type": "state",
    "common": {                                             //values here can be interpreted by iobroker
        "desc": "Basetype: 1-bit value, Subtype: switch",   //informative, from dpt
        "min": 0,                                           //derieved from dpt
        "max": 1,                                           //derieved from dpt
        "name": "Aussen Melder Licht schalten",             //informative description from ets export
        "read": true,                                       //default set, if false incoming bus values are not updating the object
        "role": "",                                         //tbd
        "type": "boolean",                                  //boolean, number, string, object, derieved from dpt
        "unit": "",                                         //derived from dpt
        "write": true                                       //default true, if set change on object is triggering knx write, succ. write sets then ack flag to true
    },
    "native": {                                             //values here can be interpreted by openknx adapter
        "address": "0/0/7",                                 //knx address
        "answer_groupValueResponse": false,                 //default false, if set to true adapter responds with value on GroupValue_Read
        "autoread": true,                                   //default true, adapter sends a GroupValue_read on start to sync its states
        "bitlength": 1,                                     //size ob knx data, derived from dpt
        "dpt": "DPT1.001",                                  //DPT
        "encoding": {                                       //informative
        "0": "Off",
        "1": "On"
        },
        "force_encoding": "",                               //informative
        "signedness": "",                                   //informative
        "valuetype": "basic"                                //composite means set via a specific javascript object
    },
    "from": "system.adapter.openknx.0",
    "user": "system.user.admin",
    "ts": 1638913951639
    }


# Adapter communication Interface Description
Handeled DPTs are: 1-21,232,237,238  
Unhandeled DPTs are written as raw buffers, the interface is a sequencial string of hexadecimal numbers. For example write '0102feff' to send values 0x01 0x02 0xfe 0xff on the bus. 
Where number datatype is used please note that interface values can be scaled.

#### API call

    setState(
        id: string,                                     // object path
        state: State | StateValue | SettableState,
        ack: false,                                     //set to false and will be set to true by KNX stack on send confirmation
        c: 'GroupValue_Read'                            //optional comment, set this value to trigger a bus read to this object, given StateValue is ignored
    ): void;



#### Description of all DPTs

|KNX DPT        |javascript datatype                	        |special values	|value range |
|---        |---        |---                                    |---|
|DPT-1	    |boolean    |                                    |false, true|
|DPT-2	    |object	    |{"priority":1 bit,"data":1 bit}	       |-|
|DPT-3	    |object	    |{"decr_incr":1 bit,"data":2 bit}	|-|
|DPT-18	    |object	    |{"save_recall":0,"scenenumber":0}	|
|DPT-21	    |object	    |{"outofservice":0,"fault":0,"overridden":0,"inalarm":0,"alarmunack":0}	|-|
|DPT-232	|object	    |{red:0..255, green:0.255, blue:0.255}	-|
|DPT-237	|object	    |{"address":0,"addresstype":0,"readresponse":0,"lampfailure":0,"ballastfailure":0,"convertorerror":0}	|-|
|DPT-4	    |string		||one character sent as 8-bit character|
|DPT-16	    |string		||one character sent as 16-character string|
|DPT-5	    |number		||8-bit unsigned value|
|DPT-5.001	|number		||0..100 [%] scaled to 1-byte|
|DPT-5.003	|number		||0..360 [°] scaled to 1-byte|
|DPT-6	    |number		||8-bit signed -128..127|
|DPT-7	    |number		||16-bit unsigned value|
|DPT-8	    |number		||2-byte signed value |-32768..32767|
|DPT-9	    |number		||2-byte floating point value|
|DPT-14	    |number		||4-byte floating point value|
|DPT-12	    |number		||4-byte unsigned value|
|DPT-13	    |number		||4-byte signed value|
|DPT-15	    |number		||4-byte|
|DPT-17	    |number		||1-byte|
|DPT-20	    |number		||1-byte|
|DPT-238 	|number		|                         |1-byte|
|DPT-10	    |number for Date Object		||-|
|DPT-11	    |number for Date Object		||-|
|DPT-19	    |number for Date Object		||-|
|rest	    |string	    |00010203..	            |-|


Only time and date information is exchanged with KNX time based datatypes, e.g. DPT-19 has unsupported fields for signal quality  

Object send and receive values are of type boolean DPT1), number (scaled, or unscaled), string.  
DPT 2 'expects a object {"priority":0,"data":1}' receive provides a strinified object of same type.  
Other joint DPTs have similar object notation.  
DPT19 expects a Number from a Date Object, Iobroker can not handle objects, fields of KNX ko that cannot be derived from timestamp are not implemented eg. quality flags

Date and time DPTs (DPT10, DPT11)  
Please have in mind that Javascript and KNX have very different base type for time and date. 
DPT10 is time (hh:mm:ss) plus "day of week". This concept is unavailable in JS, so you'll be getting/setting a regular Date Js object, but please remember you'll need to ignore the date, month and year. The exact same datagram that converts to "Mon, Jul 1st 12:34:56", will evaluate to a wildly different JS Date of "Mon, Jul 8th 12:34:56" one week later. Be warned! 
DPT11 is date (dd/mm/yyyy): the same applies for DPT11, you'll need to ignore the time part.

#### group value write
send is triggered by writing a communication object.
Communication object is triggered when a write frame is received on the bus.

#### group value read
Sending can be triggered by writing a communicaton object with comment.
Receiving, if configured will trigger a group value response (limitation: write) of the actual c.o. value, see below

#### group value response
Sending Not yet supported. Emulated if response setting is set and adapter writes a group value write.
Receiving will update the value of the iobroker object in read is set to true.

# Features
* fast import of groupaddresses in XML format
* stable knx stack
* interpretation of many DPTs
* raw read and write of unsupported DPTs
* support of group value read and group value write, group value write as response to group value request
* Autoread
* free open source




# Known Problems
- sends write instead of GroupValue_Response on GroupValue_Read
- IOBroker object role definition missing

# Limitations
- only three level group addresses are supported

## Changelog
### 0.1.2
*feature: state roles now set to best match for some elements, default is state
*doc: 


### 0.1.2
*doc: initial test release

### 0.0.19
*feature: display warning on ga import file errors

### 0.0.17
*feature: raw value handling, can now write and receive ga of unsupported dpt
*bug: setting onlyAddNewObjects fixed
*feature: adapter restart after import

### 0.0.14
*feature: import ga xml



## License
GNU LESSER GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <http://fsf.org/>

Everyone is permitted to copy and distribute verbatim copies of this license document, but changing it is not allowed.

This version of the GNU Lesser General Public License incorporates the terms and conditions of version 3 of the GNU General Public License, supplemented by the additional permissions listed below.

0. Additional Definitions.

As used herein, “this License” refers to version 3 of the GNU Lesser General Public License, and the “GNU GPL” refers to version 3 of the GNU General Public License.

“The Library” refers to a covered work governed by this License, other than an Application or a Combined Work as defined below.

An “Application” is any work that makes use of an interface provided by the Library, but which is not otherwise based on the Library. Defining a subclass of a class defined by the Library is deemed a mode of using an interface provided by the Library.

A “Combined Work” is a work produced by combining or linking an Application with the Library. The particular version of the Library with which the Combined Work was made is also called the “Linked Version”.

The “Minimal Corresponding Source” for a Combined Work means the Corresponding Source for the Combined Work, excluding any source code for portions of the Combined Work that, considered in isolation, are based on the Application, and not on the Linked Version.

The “Corresponding Application Code” for a Combined Work means the object code and/or source code for the Application, including any data and utility programs needed for reproducing the Combined Work from the Application, but excluding the System Libraries of the Combined Work.

1. Exception to Section 3 of the GNU GPL.

You may convey a covered work under sections 3 and 4 of this License without being bound by section 3 of the GNU GPL.

2. Conveying Modified Versions.

If you modify a copy of the Library, and, in your modifications, a facility refers to a function or data to be supplied by an Application that uses the facility (other than as an argument passed when the facility is invoked), then you may convey a copy of the modified version:

a) under this License, provided that you make a good faith effort to ensure that, in the event an Application does not supply the function or data, the facility still operates, and performs whatever part of its purpose remains meaningful, or
b) under the GNU GPL, with none of the additional permissions of this License applicable to that copy.
3. Object Code Incorporating Material from Library Header Files.

The object code form of an Application may incorporate material from a header file that is part of the Library. You may convey such object code under terms of your choice, provided that, if the incorporated material is not limited to numerical parameters, data structure layouts and accessors, or small macros, inline functions and templates (ten or fewer lines in length), you do both of the following:

a) Give prominent notice with each copy of the object code that the Library is used in it and that the Library and its use are covered by this License.
b) Accompany the object code with a copy of the GNU GPL and this license document.
4. Combined Works.

You may convey a Combined Work under terms of your choice that, taken together, effectively do not restrict modification of the portions of the Library contained in the Combined Work and reverse engineering for debugging such modifications, if you also do each of the following:

a) Give prominent notice with each copy of the Combined Work that the Library is used in it and that the Library and its use are covered by this License.
b) Accompany the Combined Work with a copy of the GNU GPL and this license document.
c) For a Combined Work that displays copyright notices during execution, include the copyright notice for the Library among these notices, as well as a reference directing the user to the copies of the GNU GPL and this license document.
d) Do one of the following:
0) Convey the Minimal Corresponding Source under the terms of this License, and the Corresponding Application Code in a form suitable for, and under terms that permit, the user to recombine or relink the Application with a modified version of the Linked Version to produce a modified Combined Work, in the manner specified by section 6 of the GNU GPL for conveying Corresponding Source.
1) Use a suitable shared library mechanism for linking with the Library. A suitable mechanism is one that (a) uses at run time a copy of the Library already present on the user's computer system, and (b) will operate properly with a modified version of the Library that is interface-compatible with the Linked Version.
e) Provide Installation Information, but only if you would otherwise be required to provide such information under section 6 of the GNU GPL, and only to the extent that such information is necessary to install and execute a modified version of the Combined Work produced by recombining or relinking the Application with a modified version of the Linked Version. (If you use option 4d0, the Installation Information must accompany the Minimal Corresponding Source and Corresponding Application Code. If you use option 4d1, you must provide the Installation Information in the manner specified by section 6 of the GNU GPL for conveying Corresponding Source.)
5. Combined Libraries.

You may place library facilities that are a work based on the Library side by side in a single library together with other library facilities that are not Applications and are not covered by this License, and convey such a combined library under terms of your choice, if you do both of the following:

a) Accompany the combined library with a copy of the same work based on the Library, uncombined with any other library facilities, conveyed under the terms of this License.
b) Give prominent notice with the combined library that part of it is a work based on the Library, and explaining where to find the accompanying uncombined form of the same work.
6. Revised Versions of the GNU Lesser General Public License.

The Free Software Foundation may publish revised and/or new versions of the GNU Lesser General Public License from time to time. Such new versions will be similar in spirit to the present version, but may differ in detail to address new problems or concerns.

Each version is given a distinguishing version number. If the Library as you received it specifies that a certain numbered version of the GNU Lesser General Public License “or any later version” applies to it, you have the option of following the terms and conditions either of that published version or of any later version published by the Free Software Foundation. If the Library as you received it does not specify a version number of the GNU Lesser General Public License, you may choose any version of the GNU Lesser General Public License ever published by the Free Software Foundation.

If the Library as you received it specifies that a proxy can decide whether future versions of the GNU Lesser General Public License shall apply, that proxy's public statement of acceptance of any version is permanent authorization for you to choose that version for the Library.
