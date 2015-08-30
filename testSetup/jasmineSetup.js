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
 
/*
 * An alternative to jasmine's toThrow() matcher that makes handling our dx.fail() routine more graceful.
 * dx.fail() will throw an exception and log a message to the console.  When testing, we want the exception to
 * be thrown, but we don't want the message to get written to the console, so we spy on the call to the
 * console and then pass on the behavior to the ordinary toThrow matcher.
 */
function toDxFail(expected) {
    var self = this;
    if (!jasmine.isSpy(console.error)) {
        spyOn(console, 'error');
    }
    return jasmine.Matchers.prototype.toThrow.call(self, expected);
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
function toHaveProps(expected) {
 var self = this;
 
 return _.matches(expected)(self.actual);
}

/*
 * Delphix custom jasmine setup.
 */
beforeEach(function() {
    this.addMatchers({
        toDxFail: toDxFail,
        toHaveProps: toHaveProps
    });
});

})();
