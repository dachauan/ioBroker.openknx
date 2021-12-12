"use strict";

/*
 * Created with @iobroker/create-adapter v2.0.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

var projectImport = require(__dirname + '/lib/projectImport');

var knx = require(__dirname + '/lib/knx'); //todo copy for the moment
var _ = require('underscore');
const tools = require('./lib/tools.js');

class openknx extends utils.Adapter {

    gaList = new DoubleKeyedMap();
    autoreaddone = false;

    knxConnection;
    mynamespace;

    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: "openknx",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
        //this.on("objectChange", this.onObjectChange.bind(this));
        this.on("message", this.onMessage.bind(this));
        this.on("unload", this.onUnload.bind(this));

        this.mynamespace = this.namespace;
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        // adapter initialization

        if (this.config.adapterpath !== '')
            this.mynamespace = this.config.adapterpath;
        //this.mynamespace = 'knx.0';

        // In order to get state updates, you need to subscribe to them. 
        this.subscribeForeignStates(this.mynamespace + '.*');

        this.main();
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            if (knxConnection) {
                knxConnection.Disconnect();
            }

            callback();
        } catch (e) {
            callback();
        }
    }

    // New message arrived. obj is array with current messages
    // triggered from admin page read in knx project
    onMessage(obj) {
        if (typeof obj === "object") {
            switch (obj.command) {
                case 'import':
                    this.log.info('Project import...');
                    projectImport.parseInput(obj.message.xml, obj.message.xml0, obj.message.knx_master, obj.message.file, (error, res) => {
                        if (error) {
                            res = {
                                error: error
                            };
                            this.log.info('Project import error');
                            if (obj.callback) this.sendTo(obj.from, obj.command, res, obj.callback);
                        } else {
                            this.updateObjects(res, 0, obj.message.onlyAddNewObjects, (error, length) => {
                                res = {
                                    error: error,
                                    count: length
                                };
                                this.log.info('Project import finished of ' + length + ' GAs');
                                if (obj.callback) this.sendTo(obj.from, obj.command, res, obj.callback);
                            });
                        }
                    })
                    break;
                case 'reset':
                    this.log.info('Restarting');
                    this.restart();
                    break;
                default:
                    this.log.warn('Unknown command: ' + obj.command);
                    break;
            }
        }
        return true;
    }

    //write found communication objects to adapter object tree
    updateObjects(objects, index, onlyAddNewObjects, callback) {
        if (index >= objects.length) {
            //end of recursion reached
            let err = this.warnDuplicates(objects);
            if (typeof callback === 'function')
                callback(err, objects.length);
            return;
        }
        if (onlyAddNewObjects) {
            //if user setting Add only new Objects write only new objects
            //https://www.iobroker.net/docu/index-81.htm?page_id=5809&lang=en#extendObject
            this.setForeignObjectNotExists(this.mynamespace + '.' + objects[index]._id, objects[index], (err, obj) => {
                this.log.debug('store Object ' + objects[index]._id + ' ' + (err ? ' ' + err : ''));
                setTimeout(this.updateObjects.bind(this), 0, objects, index + 1, onlyAddNewObjects, callback)
            });
        } else {
            //setObjet to overwrite all existing settings, defalut
            this.setForeignObject(this.mynamespace + '.' + objects[index]._id, objects[index], (err, obj) => {
                this.log.debug('store Object ' + objects[index]._id + (err ? ' ' + err : ''));
                setTimeout(this.updateObjects.bind(this), 0, objects, index + 1, onlyAddNewObjects, callback)
            });
        }
    }

    /*
     * IOBroker Object tree cannot store 2 objects of same name, warn
     */
    warnDuplicates(objects) {
        let arr = [];
        let duplicates = [];
        for (const object of objects) {
            arr.push(object._id);
        };
        const tempArray = [...arr].sort();
        for (let i = 0; i < tempArray.length; i++) {
            if (tempArray[i + 1] === tempArray[i]) {
                duplicates.push(tempArray[i]);
            }
        }
        if (duplicates.length) this.log.warn('Object with duplicate GroupAddress names not created: ' + duplicates);
        return duplicates.length ? 'Duplicate GA names' : null;
    }

    //obj to string and date to number for iobroker, convert to object for knx
    convertType(val) {
        var ret;
        //convert, state value for iobroker to set has to be one of type "string", "number", "boolean" and not type "object"
        if (val instanceof Date) {
            //convert Date to number
            ret = Number(new Date(val));
        } else if (Buffer.isBuffer(val)) {
            //before object check
            ret = val.toString('hex');
        } else if (typeof val === 'object') {
            ret = JSON.stringify(val);
        } else if (typeof val === 'string') {
            //use as is
        } else {
            //both can handle number and boolean
            ret = val;
        }
        return ret;
    }

    /**
     * Is called if a subscribed state changes
     * state.ack is coming in false if set by user (nodered, script...), here we set it.
     * https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    async onStateChange(id, state) {
        var isRaw = false;

        if (!id) return;
        if (!state /*obj deleted*/ || typeof state !== 'object') return;
        //not a KNX object
        if (!this.gaList.getDataById(id) || !this.gaList.getDataById(id).native || !this.gaList.getDataById(id).native.address) return;
        if (!(await this.getStateAsync('info.connection'))) {
            this.log.warn('onStateChange: not connected to KNX bus');
            return;
        }

        if (state.c == 'self') {
            //called by self, avoid loop
            //console.log('state change self id: ' + id);
            //tools.interfaceTest(id, state);
            return;
        }

        var dpt = this.gaList.getDataById(id).native.dpt;
        var ga = this.gaList.getDataById(id).native.address;
        var val = state.val;

        //convert val into object for certain dpts
        if (tools.isDateDPT(dpt)) {
            //before composite check, date is also composite
            val = new Date(val);
        } else if (this.gaList.getDataById(id).native.valuetype == 'composite') {
            try {
                val = JSON.parse(val);
            } catch (e) {
                this.log.warn('stateChange: unsupported value format ' + val + ' for ' + ga);
                return;
            }
        } else if (tools.isStringDPT(dpt)) {
            ; //val = this.convertType(val);
        } else if (tools.isUnknownDPT(dpt)) {
            //write raw buffers for unknown dpts, iterface is a hex value
            //bitlength is the buffers bytelength * 8.
            val = Buffer.from(val, 'hex');
            isRaw = true;
            this.log.warn('Missing implementation for unhandeled DPT ' + dpt + ', assuming raw values');
        } else {}

        if (state.c == 'GroupValue_Read') {
            //interface to trigger GrouValue_Read is this comment
            this.log.debug('Outgoing GroupValue_Read to ' + ga + ' value ' + val);
            this.knxConnection.read(ga);
            if (!state.ack) this.setForeignState(id, {
                ack: true,
                c: 'self'
            });
        } else if (this.gaList.getDataById(id).common.write) {
            this.log.debug('Outgoing GroupValue_Write to ' + ga + ' value ' + val + ' from ' + id);
            if (isRaw) this.knxConnection.writeRaw(ga, val);
            else this.knxConnection.write(ga, val, dpt);
            if (!state.ack) this.setForeignState(id, {
                ack: true,
                c: 'self'
            });
        } else {
            this.log.warn('not configured write to ga: ' + val);
        }
    }

    startKnxStack() {
        this.knxConnection = knx.Connection({
            ipAddr: this.config.gwip,
            ipPort: this.config.gwipport,
            physAddr: this.config.eibadr,
            minimumDelay: this.config.frameInterval,
            //map set the log level for messsages printed on the console. This can be 'error', 'warn', 'info' (default), 'debug', or 'trace'.
            // loglevel: this.log.level == 'silly' ? 'trace' : this.log.level,
            //debug:
            handlers: {
                connected: () => {
                    //create new knx datapoint and bind to connection
                    //in connected in order to have autoread work
                    var cnt_complete = 0;
                    var cnt_withDPT = 0;
                    if (!this.autoreaddone) {
                        //do autoread on start of adapter and not every connection
                        for (const key of this.gaList) {
                            if (this.gaList.getDataById(key).native.address.match(/\d*\/\d*\/\d*/) && this.gaList.getDataById(key).native.dpt) {
                                try {
                                    var dp = new knx.Datapoint({
                                        ga: this.gaList.getDataById(key).native.address,
                                        dpt: this.gaList.getDataById(key).native.dpt,
                                        autoread: this.gaList.getDataById(key).native.autoread // issue a GroupValue_Read request to try to get the initial state from the bus (if any)
                                    }, this.knxConnection);
                                    this.gaList.setDpById(key, dp);
                                    cnt_withDPT++;
                                    this.log.debug('Datapoint ' + (this.gaList.getDataById(key).native.autoread ? 'autoread ' : '') +
                                        'created and GroupValueWrite sent: ' + this.gaList.getDataById(key).native.address + ' ' + key);
                                } catch (e) {
                                    this.log.warn('could not create KNX Datapoint for ' + key + ' with error: ' + e);
                                }
                            } else {
                                this.log.warn('no match for ' + key);
                            }
                            cnt_complete++;
                        }
                        this.autoreaddone = true;
                        this.log.info('Registered with ' + cnt_withDPT + ' KNX datapoints of ' + cnt_complete + ' datapoints in adapter.');
                    }
                    this.setState('info.connection', true, true);
                    this.log.info('Connected!');
                },

                disconnected: () => {
                    this.setState('info.connection', false, true);
                    this.log.info('Connection lost');
                },

                //KNX Bus event received
                event: (evt, src, dest, val) => {
                    if (src == this.config.eibadr) {
                        //called by self, avoid loop
                        //console.log('receive self ga: ', dest);
                        return;
                    }

                    /* some checks */
                    if (!this.gaList.getDpByAddress(dest)) {
                        this.log.warn('Ignoring ' + evt + ' received on unknown GA: ' + dest);
                        return;
                    }

                    var val = tools.isStringDPT(this.gaList.getDataByAddress(dest).native.dpt) ?
                        this.gaList.getDpByAddress(dest).current_value :
                        this.convertType(this.gaList.getDpByAddress(dest).current_value);

                    switch (evt) {
                        case 'GroupValue_Read':
                            //fetch val from addressed object and write on bus if configured to answer
                            this.getForeignState(this.gaList.getIdByAddress(dest), (err, state) => {
                                this.log.debug('Incoming GroupValue_Read from ' + src + ' to ' + '(' + dest + ') ' + this.gaList.getDataByAddress(dest).common.name);
                                if (this.gaList.getDataByAddress(dest).native.answer_groupValueResponse) {
                                    //https://bitbucket.org/ekarak/knx.js/issues/83/send-groupvalue_response
                                    //workaround, send out a write instead response
                                    this.knxConnection.write(dest, state.val, this.gaList.getDataByAddress(dest).native.dpt);
                                    this.log.debug('responding with value ' + state.val);
                                }
                            });
                            break;

                        case 'GroupValue_Response':
                            this.setForeignState(this.gaList.getIdByAddress(dest), {
                                val: val,
                                ack: true,
                                c: 'self'
                            });
                            this.log.debug('Incoming GroupValue_Response from ' + src + ' to ' + '(' + dest + ') ' + this.gaList.getDataByAddress(dest).common.name + ': ' + val);
                            break;

                        case 'GroupValue_Write':
                            this.setForeignState(this.gaList.getIdByAddress(dest), {
                                val: val,
                                ack: true,
                                c: 'self'
                            });
                            this.log.debug('Incoming GroupValue_Write ga: ' + dest + '  val: ' + val + ' dpt: ' + this.gaList.getDataByAddress(dest).native.dpt + ' to Object: ' + this.gaList.getIdByAddress(dest));
                            break;

                        default:
                            this.log.debug('received unhandeled event ', evt, src, dest, val);
                    }
                }
            }
        });
    }

    //todo: after override object path settings change load states again
    main() {
        this.log.info('Connecting to knx gateway:  ' + this.config.gwip + ":" + this.config.gwipport + '   with phy. Adr:  ' + this.config.eibadr + ' minimum send delay: ' + this.config.frameInterval);
        this.log.info(utils.controllerDir);
        this.setState('info.connection', false, true);

        //fill gaList object from iobroker objects 
        this.getObjectView('system', 'state', {
            startkey: this.mynamespace + '.',
            endkey: this.mynamespace + '.\u9999',
            include_docs: true
        }, (err, res) => {
            if (err) {
                this.log.error('Cannot get objects: ' + err);
            } else {
                for (var i = res.rows.length - 1; i >= 0; i--) {
                    var id = res.rows[i].id;
                    this.gaList.set(id, res.rows[i].value.native.address, res.rows[i].value);
                }
                this.startKnxStack();
            }
        });

    }
}

class DoubleKeyedMap {
    constructor() {
        //id, ga
        this.keymap = new Map();
        //id,  iobroker object
        this.data = new Map();
        //id, knx dp
        this.dp = new Map();
    }
    //update or add
    set(id, address, data) {
        this.keymap.set(address, id);
        this.data.set(id, data);
    }
    //only dp returns transformed value, hold a reference to it
    setDpById(id, dp) {
        this.dp.set(id, dp);
    }
    getDpById(id) {
        return this.dp.get(id);
    }
    getDpByAddress(address) {
        return this.dp.get(this.keymap.get(address));
    }
    getDataById(id) {
        return this.data.get(id);
    }
    getDataByAddress(address) {
        return this.data.get(this.keymap.get(address));
    }
    getIdByAddress(address) {
        return this.keymap.get(address);
    }

    //key value is id
    [Symbol.iterator] = function () {
        return {
            index: -1,
            data: this.data,
            next() {
                return (++this.index < this.data.size) ? {
                    done: false,
                    value: Array.from(this.data.keys())[this.index]
                } : {
                    done: true
                }
            }
        }
    };
}


if (require.main !== module) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new openknx(options);
} else {
    // otherwise start the instance directly
    new openknx();
}