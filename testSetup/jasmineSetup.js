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
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global jasmine, spyOn, console */

'use strict';

(function() {
 
function getMessage(stringOrError) {
    if (stringOrError instanceof Error) {
        return stringOrError.message;
    }

    return stringOrError
}

/*
 * An alternative to jasmine's toThrow() matcher that makes handling our dx.fail() routine more graceful.
 * dx.fail() will throw an exception and log a message to the console.  When testing, we want the exception to
 * be thrown, but we don't want the message to get written to the console, so we spy on the call to the
 * console and then pass on the behavior to the ordinary toThrow matcher.
 */
function toDxFail(actual, expected) {
    if (!jasmine.isSpy(console.error)) {
        spyOn(console, 'error');
    }

    var actualMessage;
    var expectedMessage = getMessage(expected);

    try {
        actual();
    } catch (e) {
        actualMessage = e.message;
    }

    var pass = expected ? actualMessage === expectedMessage : !!actualMessage

    return {
        pass: pass,
        message: "Actual and expected error messages do not match: " + actualMessage + " " + expectedMessage,
    }
}

 
/*
 * A matcher that allows one to check if a subset of the properties specified match those of the test result.
 * That is, suppose the test result returns:
 *    {
 *        a: true,
 *        b: 2,
 *        c: 'three'
 *    }
 * but for your test you only care about whether a and b match.  Thus, you could say:
 *    expect(resultObject).toEqualProps({ a: true, b: 2});
 *
 * and this would pass. In contrast these would not:
 *    expect(resultObject).toEqualProps({ a: true, d: 4});
 *    expect(resultObject).toEqualProps({ a: true, b: 'six'});
 * Note: This does not at this time do this recursively.
 */
function toHaveProps(actual, expected) {
    return {
        pass: _.matches(expected)(actual),
        message: "Object properties do not match: " + JSON.stringify(actual) + " " + JSON.stringify(expected),
    }
}

/*
 * Delphix custom jasmine setup.
 */
beforeEach(function() {
    jasmine.addMatchers({
        toDxFail: function(util, customEqualityTesters) {
            return {
                compare: toDxFail
            }
        },
        toHaveProps: function(util, customEqualityTesters) {
            return {
                compare: toHaveProps
            }
        }
    });
});

})();
