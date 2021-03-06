'use strict';

var assert = require('chai').assert;
var Promise = require('bluebird');
var Redlock = require('./redlock');

test('https://www.npmjs.com/package/redis', [require('redis').createClient()]);
test('https://www.npmjs.com/package/ioredis', [new (require('ioredis'))()]);

/* istanbul ignore next */
function test(name, clients){
	var redlock = new Redlock(clients, {
		retryCount: 2,
		retryDelay: 150
	});

	var resource = 'Redlock:test:resource';

	describe('Redlock: ' + name, function(){

		describe('callbacks', function(){
			before(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});

			it('should throw an error if not passed any clients', function(){
				assert.throws(function(){
					new Redlock([], {
						retryCount: 2,
						retryDelay: 150
					});
				});
			});

			var one;
			it('should lock a resource', function(done){
				redlock.lock(resource, 200, function(err, lock){
					if(err) throw err;
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					one = lock;
					done();
				});
			});

			var two;
			var two_expiration;
			it('should wait until a lock expires before issuing another lock', function(done){
				assert(one, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 800, function(err, lock){
					if(err) throw err;
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isAbove(Date.now()+1, one.expiration);
					two = lock;
					two_expiration = lock.expiration;
					done();
				});
			});

			it('should unlock a resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.unlock(done);
			});

			it('should silently fail to unlock an already-unlocked resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.unlock(done);
			});

			it('should fail to extend a lock on an already-unlocked resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.extend(200, function(err, lock){
					assert.isNotNull(err);
					assert.instanceOf(err, Redlock.LockError);
					done();
				});
			});

			var three;
			it('should issue another lock immediately after a resource is unlocked', function(done){
				assert(two_expiration, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 800, function(err, lock){
					if(err) throw err;
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isBelow(Date.now()-1, two_expiration);
					three = lock;
					done();
				});
			});

			var four;
			it('should extend an unexpired lock', function(done){
				assert(three, 'Could not run because a required previous test failed.');
				three.extend(800, function(err, lock){
					if(err) throw err;
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isAbove(lock.expiration, three.expiration-1);
					assert.equal(three, lock);
					four = lock;
					done();
				});
			});

			it('should fail after the maximum retry count is exceeded', function(done){
				assert(four, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 200, function(err, lock){
					assert.isNotNull(err);
					assert.instanceOf(err, Redlock.LockError);
					done();
				});
			});

			it('should fail to extend an expired lock', function(done){
				assert(four, 'Could not run because a required previous test failed.');
				setTimeout(function(){
					three.extend(800, function(err, lock){
						assert.isNotNull(err);
						assert.instanceOf(err, Redlock.LockError);
						done();
					});
				}, four.expiration - Date.now() + 100);
			});

			it('should issue another lock immediately after a resource is expired', function(done){
				assert(four, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 800, function(err, lock){
					if(err) throw err;
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					done();
				});
			});

			after(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});
		});

		describe('promises', function(){
			before(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});

			it('should throw an error if not passed any clients', function(){
				assert.throws(function(){
					new Redlock([], {
						retryCount: 2,
						retryDelay: 150
					});
				});
			});

			var one;
			it('should lock a resource', function(done){
				redlock.lock(resource, 200)
				.done(function(lock){
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					one = lock;
					done();
				}, done);
			});

			var two;
			var two_expiration;
			it('should wait until a lock expires before issuing another lock', function(done){
				assert(one, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 800)
				.done(function(lock){
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isAbove(Date.now()+1, one.expiration);
					two = lock;
					two_expiration = lock.expiration;
					done();
				}, done);
			});

			it('should unlock a resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.unlock().done(done, done);
			});

			it('should silently fail to unlock an already-unlocked resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.unlock().done(done, done);
			});

			it('should fail to extend a lock on an already-unlocked resource', function(done){
				assert(two, 'Could not run because a required previous test failed.');
				two.extend(200)
				.done(function(){
					done(new Error('Should have failed with a LockError'));
				}, function(err){
					assert.instanceOf(err, Redlock.LockError);
					done();
				});
			});

			var three;
			it('should issue another lock immediately after a resource is unlocked', function(done){
				assert(two_expiration, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 800)
				.done(function(lock){
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isBelow(Date.now()-1, two_expiration);
					three = lock;
					done();
				}, done);
			});

			var four;
			it('should extend an unexpired lock', function(done){
				assert(three, 'Could not run because a required previous test failed.');
				three.extend(800)
				.done(function(lock){
					assert.isObject(lock);
					assert.isAbove(lock.expiration, Date.now()-1);
					assert.isAbove(lock.expiration, three.expiration-1);
					assert.equal(three, lock);
					four = lock;
					done();
				}, done);
			});

			it('should fail after the maximum retry count is exceeded', function(done){
				assert(four, 'Could not run because a required previous test failed.');
				redlock.lock(resource, 200)
				.done(function(){
					done(new Error('Should have failed with a LockError'));
				}, function(err){
					assert.instanceOf(err, Redlock.LockError);
					done();
				});
			});

			it('should fail to extend an expired lock', function(done){
				assert(four, 'Could not run because a required previous test failed.');
				setTimeout(function(){
					three.extend(800)
					.done(function(){
						done(new Error('Should have failed with a LockError'));
					}, function(err){
						assert.instanceOf(err, Redlock.LockError);
						done();
					});
				}, four.expiration - Date.now() + 100);
			});

			after(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});
		});

		describe('disposer', function(){
			before(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});

			var one;
			var one_expiration;
			it('should automatically release a lock after the using block', function(done){
				Promise.using(
					redlock.disposer(resource, 200),
					function(lock){
						assert.isObject(lock);
						assert.isAbove(lock.expiration, Date.now()-1);
						one = lock;
						one_expiration = lock.expiration;
					}
				).done(done, done);
			});

			var two;
			var two_expiration;
			it('should issue another lock immediately after a resource is unlocked', function(done){
				assert(one_expiration, 'Could not run because a required previous test failed.');
				Promise.using(
					redlock.disposer(resource, 800),
					function(lock){
						assert.isObject(lock);
						assert.isAbove(lock.expiration, Date.now()-1);
						assert.isBelow(Date.now()-1, one_expiration);
						two = lock;
						two_expiration = lock.expiration;
					}
				).done(done, done);
			});

			var three_original, three_extended;
			var three_original_expiration;
			var three_extended_expiration;
			it('should automatically release an extended lock', function(done){
				assert(two_expiration, 'Could not run because a required previous test failed.');
				Promise.using(
					redlock.disposer(resource, 200),
					function(lock){
						assert.isObject(lock);
						assert.isAbove(lock.expiration, Date.now()-1);
						assert.isBelow(Date.now()-1, two_expiration);
						three_original = lock;
						three_original_expiration = lock.expiration;
						
						return Promise.delay(100)
						.then(function(){ return lock.extend(200); })
						.then(function(extended) {
							assert.isObject(extended);
							assert.isAbove(extended.expiration, Date.now()-1);
							assert.isBelow(Date.now()-1, three_original_expiration);
							assert.isAbove(extended.expiration, three_original_expiration);
							assert.equal(extended, lock);
							three_extended = extended;
							three_extended_expiration = extended.expiration;
						});
					}
				)
				.then(function(){
					assert.equal(three_original.expiration, 0);
					assert.equal(three_extended.expiration, 0);
				}).done(done, done);
			});

			after(function(done){
				var err;
				var l = clients.length; function cb(e){ if(e) err = e; l--; if(l === 0) done(err); }
				for (var i = clients.length - 1; i >= 0; i--) {
					clients[i].del(resource, cb);
				}
			});
		});

	});
}