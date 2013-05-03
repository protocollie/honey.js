(function() {
	var calculatingDependencies = false,
		queriedObservables;

	// A honey observable.
	function observable(value) {
		var cachedValue,
			me = this,
			mutator,
			subscribers = [],
			dependencies = [],
			exported;

		function isDependent() {
			return typeof mutator === 'function';
		}

		function setupDependent(mutatorFunction) {
			var dependency, i, j, parentDependencies, parentDependency, index;

			// Let everyone know we're calculating our dependencies.
			calculatingDependencies = true;
			queriedObservables = [];

			// Save our mutator
			mutator = mutatorFunction;

			// The mutator takes the old value
			cachedValue = mutator(cachedValue);

			// Finish calculating dependencies.
			calculatingDependencies = false;

			// Subscribe to all our dependencies.
			for (i = 0; i < queriedObservables.length; i += 1) {
				dependency = queriedObservables[i];

				// First, let's resolve if this dependency lets us eliminate any other dependencies further up the chain.
				var parentDependencies = dependency.resolve(queriedObservables);

				// We don't need to subscribe to any of the dependencies of this dependency.
				if (parentDependencies.length > 0) {
					for (j = 0; j < parentDependencies.length; j += 1) {
						parentDependency = parentDependencies[j];

						// First check if we already have a dependency on this value.
						index = dependencies.indexOf(parentDependency);
						if (index >= 0) {
							dependencies[index].unsubscribe(exported);
							dependencies.splice(index, 1);
							continue;
						}

						index = queriedObservables.indexOf(parentDependency);
						if (index >= 0) {
							queriedObservables.splice(index, 1);
							continue;
						}
					}
				}

				// If we made it here, subscribe to this dependency.
				dependency.subscribe(exported);
				dependencies.push(dependency);
			}
		}

		function setup(value) {
			cachedValue = value;
		}

		function mutate(value) {
			var subscriber, i;

			if (isDependent()) {
				value = mutator(cachedValue);
			}

			// Update the cached value
			cachedValue = value;

			// If nobody's subscribed to us we have nothing to do.
			// We must also not be very interesting :(
			if (subscribers.length === 0) {
				return;
			}

			// LET. THEM. KNOW.
			for(i = 0; i < subscribers.length; i += 1) {
				subscriber = subscribers[i];
				subscriber(cachedValue);
			}
		}

		function query() {
			if (calculatingDependencies && queriedObservables.indexOf(exported) < 0) {
				queriedObservables.push(exported);
			}

			// In the end, we just want to return the value from here.
			return cachedValue;
		}

		// Determines if this observable wraps up multiple dependencies of a subscribing observable. 
		function resolve(externalDependencies) {
			var sharedDependencies = [],
				i, j, 
				dependency,
				parentSharedDependencies;

			// Look through each of our dependencies...
			for (i = 0; i < dependencies.length; i += 1) {
				dependency = dependencies[i];

				// See if this dependency is a shared dependency.
				if (externalDependencies.indexOf(dependency) >= 0 && sharedDependencies.indexOf(dependency) < 0) {
					sharedDependencies.push(dependency);
				}

				// See if this dependency has any shared dependencies.
				parentSharedDependencies = dependency.resolve(externalDependencies);

				// If we have any, then make sure they're not already in the list and add them.
				for (j = 0; j < parentSharedDependencies.length; j++) {
					dependency = parentSharedDependencies[j];
					if (sharedDependencies.indexOf(dependency) < 0) { 
						sharedDependencies.push(dependency);
					}
				}
			}

			// And return all the shared dependencies.
			return sharedDependencies;
		}

		function subscribe(onMutated) {
			subscribers.push(onMutated);
		}

		function unsubscribe(onMutated) {
			var index = subscribers.indexOf(onMutated);
			if (index >= 0) {
				subscribers.splice(index, 1);
			}
		}

		exported = function(value) {
			if (value !== undefined) {
				mutate(value);
			} else {
				return query();
			}
		};
		
		exported.resolve = resolve;
		exported.subscribe = subscribe;
		exported.unsubscribe = unsubscribe;

		// Set up our observable
		if (typeof value === 'function') {
			setupDependent(value);
		} else {
			setup(value);
		}

		return exported;
	}

	// Actually perform the data bind
	// If elementId is null then we bind the whole page.
	function bind(model, elementId) {
		
	}

	// Time to do some exports
	window.honey = {
		observable: observable,
		bind: bind
	};
})();