/*******************************************************************************

    uBlock Origin - a browser extension to block requests.
    Copyright (C) 2017-present Raymond Hill

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see {http://www.gnu.org/licenses/}.

    Home: https://github.com/gorhill/uBlock
*/

'use strict';

/******************************************************************************/

const StaticExtFilteringHostnameDB = class {
    constructor(nBits, selfie = undefined) {
        this.nBits = nBits;
        this.timer = undefined;
        this.strToIdMap = new Map();
        this.hostnameToSlotIdMap = new Map();
        this.regexToSlotIdMap = new Map();
        this.regexMap = new Map();
        // Array of integer pairs
        this.hostnameSlots = [];
        // Array of strings (selectors and pseudo-selectors)
        this.strSlots = [];
        this.size = 0;
        if ( selfie !== undefined ) {
            this.fromSelfie(selfie);
        }
    }

    store(hn, bits, s) {
        this.size += 1;
        let iStr = this.strToIdMap.get(s);
        if ( iStr === undefined ) {
            iStr = this.strSlots.length;
            this.strSlots.push(s);
            this.strToIdMap.set(s, iStr);
            if ( this.timer === undefined ) {
                this.collectGarbage(true);
            }
        }
        const strId = iStr << this.nBits | bits;
        const hnIsNotRegex = hn.charCodeAt(0) !== 0x2F /* / */;
        let iHn = hnIsNotRegex
            ? this.hostnameToSlotIdMap.get(hn)
            : this.regexToSlotIdMap.get(hn);
        if ( iHn === undefined ) {
            if ( hnIsNotRegex ) {
                this.hostnameToSlotIdMap.set(hn, this.hostnameSlots.length);
            } else {
                this.regexToSlotIdMap.set(hn, this.hostnameSlots.length);
            }
            this.hostnameSlots.push(strId, 0);
            return;
        }
        // Add as last item.
        while ( this.hostnameSlots[iHn+1] !== 0 ) {
            iHn = this.hostnameSlots[iHn+1];
        }
        this.hostnameSlots[iHn+1] = this.hostnameSlots.length;
        this.hostnameSlots.push(strId, 0);
    }

    clear() {
        this.hostnameToSlotIdMap.clear();
        this.regexToSlotIdMap.clear();
        this.hostnameSlots.length = 0;
        this.strSlots.length = 0;
        this.strToIdMap.clear();
        this.regexMap.clear();
        this.size = 0;
    }

    collectGarbage(later = false) {
        if ( later === false ) {
            if ( this.timer !== undefined ) {
                self.cancelIdleCallback(this.timer);
                this.timer = undefined;
            }
            this.strToIdMap.clear();
            return;
        }
        if ( this.timer !== undefined ) { return; }
        this.timer = self.requestIdleCallback(
            ( ) => {
                this.timer = undefined;
                this.strToIdMap.clear();
            },
            { timeout: 5000 }
        );
    }

    // modifiers = 0: all items
    // modifiers = 1: only specific items
    // modifiers = 2: only generic items
    // modifiers = 3: only regex-based items
    //
    retrieve(hostname, out, modifiers = 0) {
        let hn = hostname;
        if ( modifiers === 2 ) { hn = ''; }
        const mask = out.length - 1; // out.length must be power of two
        for (;;) {
            let iHn = this.hostnameToSlotIdMap.get(hn);
            if ( iHn !== undefined ) {
                do {
                    const strId = this.hostnameSlots[iHn+0];
                    out[strId & mask].add(this.strSlots[strId >>> this.nBits]);
                    iHn = this.hostnameSlots[iHn+1];
                } while ( iHn !== 0 );
            }
            if ( hn === '' ) { break; }
            const pos = hn.indexOf('.');
            if ( pos === -1 ) {
                if ( modifiers === 1 ) { break; }
                hn = '';
            } else {
                hn = hn.slice(pos + 1);
            }
        }
        if ( modifiers !== 0 && modifiers !== 3 ) { return; }
        // TODO: consider using a combined regex to test once for whether
        // iterating is worth it.
        for ( const restr of this.regexToSlotIdMap.keys() ) {
            let re = this.regexMap.get(restr);
            if ( re === undefined ) {
                this.regexMap.set(restr, (re = new RegExp(restr.slice(1,-1))));
            }
            if ( re.test(hostname) === false ) { continue; }
            let iHn = this.regexToSlotIdMap.get(restr);
            do {
                const strId = this.hostnameSlots[iHn+0];
                out[strId & mask].add(this.strSlots[strId >>> this.nBits]);
                iHn = this.hostnameSlots[iHn+1];
            } while ( iHn !== 0 );
        }
    }

    toSelfie() {
        return {
            hostnameToSlotIdMap: Array.from(this.hostnameToSlotIdMap),
            regexToSlotIdMap: Array.from(this.regexToSlotIdMap),
            hostnameSlots: this.hostnameSlots,
            strSlots: this.strSlots,
            size: this.size
        };
    }

    fromSelfie(selfie) {
        if ( selfie === undefined ) { return; }
        this.hostnameToSlotIdMap = new Map(selfie.hostnameToSlotIdMap);
        // Regex-based lookup available in uBO 1.47.0 and above
        if ( Array.isArray(selfie.regexToSlotIdMap) ) {
            this.regexToSlotIdMap = new Map(selfie.regexToSlotIdMap);
        }
        this.hostnameSlots = selfie.hostnameSlots;
        this.strSlots = selfie.strSlots;
        this.size = selfie.size;
    }
};

/******************************************************************************/

export {
    StaticExtFilteringHostnameDB,
};

/******************************************************************************/
