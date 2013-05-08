(function() {
	var calculatingDependencies = false,
		queriedObservables,
		handlers = {},
		formatters = {};

	// A honey observable.
	function observable(value, format) {
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

		function mutate(value, formatted) {
			var subscriber, i;

			if (format && formatted) {
				value = getSanitized(value);
			}

			if (isDependent()) {
				value = mutator(cachedValue);
			}

			if (cachedValue === value) {
				return;
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
				for (j = 0; j < parentSharedDependencies.length; j += 1) {
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

		function getFormatted() {
			return formatters[format].formatter(cachedValue);
		}

		function getSanitized(value) {
			return formatters[format].sanitizer(value);
		}

		exported = function(value, formatted) {
			if (value !== undefined) {
				mutate(value, formatted);
			} else {
				return query();
			}
		};
		
		exported.resolve = resolve;
		exported.subscribe = subscribe;
		exported.unsubscribe = unsubscribe;
		exported.isDependent = isDependent;

		// Mark it as an observable
		exported.observable = true;

		// Do we have a formatter?
		if (format) {
			if (format && (typeof formatters[format] !== 'object' || typeof formatters[format].formatter !== 'function' || typeof formatters[format].sanitizer !== 'function')) {
				throw 'Unknown format, or formatter does not implement a formatter and a sanitizer!';
			}
			exported.formatted = getFormatted;
		}

		// Set up our observable
		if (typeof value === 'function') {
			setupDependent(value);
		} else {
			setup(value);
		}

		return exported;
	}

	// A honey binding context
	function bindingContext(model, root) {
		var bindingCache = [];

		function bind() {
			var elements = root.getElementsByTagName('*'),
				i, j, element, boundElements, bindings, bindingParts, handler;

			// Filter out only the items that are databound.
			boundElements = findBindings(elements);

			// Actually bind all the elements that need binding.
			for (i = 0; i < boundElements.length; i += 1) {
				// Break up the binding string into individual bindings.
				bindings = boundElements[i].binding.split(',');

				// Let's create all the bindings
				for (j = 0; j < bindings.length; j++) {
					bindingParts = bindings[j].split(':');

					// Create the correct binding handler
					handler = new handlers[bindingParts[0].trim()]({
						element: boundElements[i].element,
						observable: findInModel(bindingParts[1].trim())
					});
					bindingCache.push(handler);
				}
			}
		}

		function findBindings(elements) {
			var boundElements = [], binding;

			for (i = 0; i < elements.length; i += 1) {
				binding = elements[i].getAttribute('data-bind');
				if (binding !== null) {
					boundElements.push({
						element: elements[i],
						binding: binding,
						model: model
					});
				}
			}

			return boundElements;
		}

		function findInModel(fullPath) {
			var pathParts = fullPath.split('.').reverse(),
				current = model;

			while(pathParts.length > 0) {
				current = current[pathParts.pop()];
			}

			return current;
		}

		// Handle the initial binding
		bind();
	}

	function pack(model) {
		var packedModel = {},
			property;

		for (property in model) {
			if (model.hasOwnProperty(property)) {
				if(model[property].observable) {
					packedModel[property] = model[property]();
				} else if (typeof model[property] === 'object') {
					packedModel[property] === pack(model[property]);
				} else {
					packedModel[property] === model[property];
				}
			}
		}

		return packedModel;
	}

	function unpack(model, target) {
		target = target ? target : {};

		for (property in model) {
			if (model.hasOwnProperty(property)) {
				if (typeof model[property] === 'object') {
					target[property] = unpack(model[property], target[property]);
				}
				else if (target.hasOwnProperty(property) && target[property].observable) {
					target[property](model[property]);
				}
				else {
					target[property] = new observable(model[property]);
				}
			}
		}

		return target;
	}

	// Actually perform the data bind
	// If elementId is null then we bind the whole page.
	function bind(model, elementId) {
		// Find the root element of the binding context. Otherwise, bind the whole damn page.
		var root = elementId !== undefined ? document.getElementById('elementId') : document.getElementsByTagName('html')[0];

		// Create a binding context and wire up the page.
		return new bindingContext(model, root);
	}

	// Time to do some exports
	window.honey = {
		observable: observable,
		bind: bind,
		handlers: handlers,
		formatters: formatters,
		pack: pack,
		unpack: unpack
	};
})();

// Text binding
(function(honey) {
	honey.handlers['text'] = function(binding) {
		function update() {
			if(binding.observable.hasOwnProperty('formatted')) {
				binding.element.innerText = binding.observable.formatted();
			} else {
				binding.element.innerText = binding.observable();
			}
		}

		// Subscribe to the observable
		binding.observable.subscribe(update);

		// Perform initial binding
		update();
	};
})(window.honey);

// Value binding
(function(honey) {
	// TODO: Handle all input types correctly.
	honey.handlers['value'] = function(binding) {
		var element = binding.element,
			observable = binding.observable;

		function updateInput() {
			element.value = observable.hasOwnProperty('formatted') ? observable.formatted() : observable();
		}

		function mutateObservable() {
			observable(element.value, true);
			if (observable.hasOwnProperty('formatted')) {
				element.value = binding.observable.formatted();
			}
		}

		// Subscribe to events and observable updates
		observable.subscribe(updateInput);
		element.addEventListener('change', mutateObservable, false);

		// Perform initial binding
		updateInput();
	};
})(window.honey);

// Money Formatter
(function(honey) {
	honey.formatters['money'] = { 
		formatter: function(value) { return '$' + value; },
		sanitizer: function(value) { return parseInt(value.replace(/\$/, '')); }
	};
})(window.honey);