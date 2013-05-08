honey.js
========

a lightweight model-binding framework for modern browsers with a focus on simplicity.

how to use
========

simply include honey.js in your web project. create a model with observable properties, and then call honey.bind(). if you want to scope your bindings to a specific element, feel free to pass an element id to the second argument of the bind method.

observables
========

observables should be familiar to anyone who has worked with a library like knockout. to create a simple observable:

    var myObservable = new honey.observable(123);

to create a dependent observable, pass a function instead of a value.

    var myDependant = new honey.observable(function() {
        return 'The value of myObservable is ' + myObservable();
    });

to create a formatted observable, simply pass a formatter type as the second argument.

    var myFormattedObservable = new honey.observable(42, 'money');

when you bind this observable to a DOM element, it will be displayed to the user as its formatted value. when you access it in your code, you will have the unformatted value (though you still have access to the formatted one, if you want it.)

custom binding handlers and formatters
========

the binding handlers and formatters are all grouped together at the end of the source file and implementation is very simple.

binding handlers are simply functions that take binding details (a combination of an element and an observable.) this will likely change to support more complex bindings requiring configuration, like style bindings.

formatters are pretty set in stone, and are objects with a formatter and sanitizer function attached to them.
