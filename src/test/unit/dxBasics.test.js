/*global xit */
/*eslint-env jasmine */
/*global dx */

'use strict';

describe('dx.core.ajax.', function() {

    afterEach(function () {
        dx.core.ajax.resetAjaxHandlers();
    });

    describe('ajaxCall()', function() {

        it('calls the base handler when called by default', function() {
            dx.core.ajax.resetAjaxHandlers();
            const baseHandler = dx.core.ajax.getAjaxBaseHandler();
            spyOn(baseHandler, 'handler');
            var errorHandler = function() {};
            var successHandler = function() {};
            spyOn($, 'ajax');

            dx.core.ajax.ajaxCall({
                url: 'http://www.delphix.com',
                success: successHandler,
                error: errorHandler,
            });

            expect(baseHandler.handler).toHaveBeenCalledWith({
                url: 'http://www.delphix.com',
                type: 'GET',
                contentType: 'application/json',
                dataType: 'json',
                xhrFields: {
                    withCredentials: true
                },
                success: successHandler,
                error: errorHandler,
                cache: false,
            });
        });

        it('calls a custom handler if it is at the top of the handler stack', function() {
            var owner = 'Test';
            var handler = jasmine.createSpy('handlerSpy');
            var errorHandler = function() {};
            var successHandler = function() {};

            dx.core.ajax.registerAjaxHandler(owner, handler);

            dx.core.ajax.ajaxCall({
                url: 'http://www.delphix.com',
                success: successHandler,
                error: errorHandler,
            });

            dx.core.ajax.removeAjaxHandler(owner);

            expect(handler).toHaveBeenCalledWith({
                url: 'http://www.delphix.com',
                type: 'GET',
                contentType: 'application/json',
                dataType: 'json',
                xhrFields: {
                    withCredentials: true
                },
                success: successHandler,
                error: errorHandler,
                cache: false,
            });
        });

    });

    describe('registerAjaxHandler()', function() {

        it('adds a handler to the top of the handler stack', function() {
            var owner = 'Test';
            var handler = function() {};

            dx.core.ajax.registerAjaxHandler(owner, handler);

            expect(dx.core.ajax._handlers.length).toEqual(2);
        });

    });

    describe('hasAjaxHandler()', function() {

        it('reports false if the owner has not been registered', function() {
            var owner = 'Test';
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(owner, handler);

            const result = dx.core.ajax.hasAjaxHandler('other');

            expect(result).toEqual(false);
        });

        it('reports true if the owner has been registered', function() {
            var owner = 'Test';
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(1, handler);
            dx.core.ajax.registerAjaxHandler(2, handler);
            dx.core.ajax.registerAjaxHandler(3, handler);
            dx.core.ajax.registerAjaxHandler(owner, handler);
            dx.core.ajax.registerAjaxHandler(4, handler);

            const result = dx.core.ajax.hasAjaxHandler(owner);

            expect(result).toEqual(true);
        });
    });

    describe('removeAjaxHandler()', function() {

        it('removes a handler from the top of the stack', function() {
            var owner = 'Test';
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(owner, handler);

            dx.core.ajax.removeAjaxHandler(owner);

            expect(dx.core.ajax._handlers.length).toEqual(1);
            expect(dx.core.ajax._handlers[0].owner).toEqual('dx.baseHandler');
        });

        it('removes a handler from the middle of the stack', function() {
            var owner = 'Test';
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(1, handler);
            dx.core.ajax.registerAjaxHandler(2, handler);
            dx.core.ajax.registerAjaxHandler(3, handler);
            dx.core.ajax.registerAjaxHandler(owner, handler);
            dx.core.ajax.registerAjaxHandler(4, handler);

            dx.core.ajax.removeAjaxHandler(owner);

            expect(dx.core.ajax._handlers[3].owner).toEqual(3);
            expect(dx.core.ajax._handlers[4].owner).toEqual(4);
        });

        it('throws an error if asked to remove a handler that does not exist', function() {
            var owner = 'Test';

            expect(function () {
                dx.core.ajax.removeAjaxHandler(owner);
            }).toThrowError('That handler has not been registered.');
        });

    });

    describe('resetAjaxHandlers()', function() {

        it('removes all but the base handler', function() {
            var owner = 'Test';
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(1, handler);
            dx.core.ajax.registerAjaxHandler(2, handler);
            dx.core.ajax.registerAjaxHandler(3, handler);
            dx.core.ajax.registerAjaxHandler(owner, handler);
            dx.core.ajax.registerAjaxHandler(4, handler);

            dx.core.ajax.resetAjaxHandlers();

            expect(dx.core.ajax._handlers.length).toEqual(1);
            expect(dx.core.ajax._handlers[0].owner).toEqual('dx.baseHandler');
        });

    });

    describe('getAjaxBaseHandler()', function() {

        it('returns the bottom ajax handler', function() {
            var handler = function() {};
            dx.core.ajax.registerAjaxHandler(1, handler);
            dx.core.ajax.registerAjaxHandler(2, handler);
            dx.core.ajax.registerAjaxHandler(3, handler);

            const result = dx.core.ajax.getAjaxBaseHandler();

            expect(result.owner).toEqual('dx.baseHandler');
        });

    });

    describe('setAjaxBaseHandler()', function() {

        it('replaces the bottom ajax handler', function() {
            const temp = dx.core.ajax.getAjaxBaseHandler();
            var handler = function(args) {
                console.log('wtf', args)
            };
            dx.core.ajax.registerAjaxHandler(1, handler);
            dx.core.ajax.registerAjaxHandler(2, handler);
            dx.core.ajax.registerAjaxHandler(3, handler);
            dx.core.ajax.setAjaxBaseHandler('foo', handler);

            const result = dx.core.ajax.getAjaxBaseHandler();

            expect(result.owner).toEqual('foo');
            dx.core.ajax.setAjaxBaseHandler(temp.owner, temp.handler);
        });

    });

});
