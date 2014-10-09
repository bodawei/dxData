/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2013, 2014 by Delphix. All rights reserved.
 */

/*global dx, _ */

"use strict";

dx.namespace("dx.core.data.util");

/*
 * Misc data-related utilities.  Generally not needed unless you are bypassing dx.core.data in some fashion.
 */
(function() {

/*
 * Converts a datetime string from the format the server returns (YYYY-MM-DDTHH:MM:SS.MMMZ) into a Javascript Date
 * object.
 */
function engineTimeToDateObject(timeString) {
    var parsedDate = new Date(timeString);

    // in case of IE 9 or less, the format has to be converted to: YYYY/MM/DDThh:mm:ss
    if (isNaN(parsedDate)) {
        var s = timeString.split(/\D/);
        parsedDate = new Date(Date.UTC(s[0], --s[1]||"", s[2]||"", s[3]||"", s[4]||"", s[5]||"", s[6]||""));
    }

    return parsedDate;
}

/*
 * Converts a date object to a string in the format the server expects.
 *
 * You might think we could just say "toJSON()" to get the job done. However, dear IE8 doesn't report the
 * milliseconds for that call. So, we hand build the MS part
 */
function dateObjectToEngineTime(date) {
    var result = date.toJSON();

    // IE 8 doesn't include the milliseconds when toJSON is called. Catch this case and add the milliseconds
    if (result && result.length === 20) {
        var ms = date.getUTCMilliseconds();
        result = result.substring(0, 19) + "." + (ms < 10 ? "00" : (ms < 100 ? "0" : "")) + ms + "Z";
    }

    return result;
}

_.extend(dx.core.data.util, {
    engineTimeToDate: engineTimeToDateObject,
    dateToEngineTime: dateObjectToEngineTime
});

})();
