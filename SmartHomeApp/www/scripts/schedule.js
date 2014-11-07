$(document).on("pagecreate", "#schedule", function () { // When the "device" page is inserted into the DOM...

    /**
     * Flow for adding widgets to the "Schedule" page...
     */
    var params = $SH_GetParameters($(this).attr("data-url"));

    var schedule;

    if (!params.id && !params.value) { // Verify that we have the correct URL parameters...
        throw new Error("Missing required URL parameters");
    }
    else { // Pump the page full of widgets...

        // Match the device to the URL 'id' query string parameter
        for (var i in global[SCHEDULES_GLOBAL]) {
            if (i.replace(/[^a-z0-9_]/ig, '-').toUpperCase() == params.id.toUpperCase()) {
                schedule = global[SCHEDULES_GLOBAL][i];
                schedule.name = i.replace(/[^a-z0-9_:]/ig, ' ');
                schedule.key = i;
            }
        }

        // The schedule doesn't exist for some reason, even though we iterated through the SCHEDULES_GLOBAL,
        // this should never happen.
        if (!schedule)
            throw new Error("Unable to find schedule. The schedule '" + schedule.name + "' does not exist.");

        injectSettings("#schedule", params, schedule);
        injectWidgets("#schedule", params, schedule);

        $("#schedule-input-device").change(function () {

            schedule.device = $(this).val();
            schedule.setting_path = [];
            schedule.setting_value = [];

            FIREBASE_SCHEDULES_OBJ.child(schedule.key).update(schedule);

            $(".widgets-wrapper").empty();
            injectWidgets("#schedule", params, schedule);
            global[resizeHeight]();
        });

        $("#schedule-input-device").change(function () {

            schedule.device = $(this).val();
            schedule.setting_path = [];
            schedule.setting_value = [];

            FIREBASE_SCHEDULES_OBJ.child(schedule.key).update(schedule);

            $(".widgets-wrapper").empty();
            injectWidgets("#schedule", params, schedule);
            global[resizeHeight]();
        });

        $("#delete-schedule").click(function (e) {

            e.stopPropagation();
            e.preventDefault();

            FIREBASE_SCHEDULES_OBJ.child(schedule.key).remove();
            $.mobile.changePage('schedules.html');
            return;
        });
    }

}); // End $(document).on("pagecreate")

$(document).on("pagebeforecreate", "#schedule", function () { // When the "device" page is inserted into the DOM...
    var keys = Object.keys(global[DEVICES_GLOBAL]);
    for (var i in global[DEVICES_GLOBAL]) {
        $("#schedule-input-device").append('<option ' + ((keys[0] == i) ? "selected" : "") + ' value="' + global[DEVICES_GLOBAL][i].mac + '">' + UCFirst(global[DEVICES_GLOBAL][i].name.replace(/[^a-z0-9]/ig, ' ')) + '</option>')
    }
});



function injectSettings(page, params) {


}

/**
 * Injects the device page with widgets based on the "widgets"
 * object in the device's firebase path.
 *
 * @param page      - The page in which we are injecting the widgets.
 * @param params    - The URL query string arguments
 */
function injectWidgets(page, params, schedule) {

    // Cleanup the parameters, formatting them all pretty like.
    var params = $SH_CleanParams(params);

    var device;

    for (var i in global[DEVICES_GLOBAL]) {
        if (global[DEVICES_GLOBAL][i].mac == schedule.device) {
            device = global[DEVICES_GLOBAL][i];
        }
    }

    // The device doesn't exist for some reason, even though we iterated through the DEVICES_GLOBAL,
    // this should never happen.
    if (!device)
        throw new Error("Unable to pair device to schedule. The device " + schedule.device + " does not exist.");

    // <---------------------- Begin jQuery Widget Injection ---------------------->

    // Make the page header the device's name
    $(page + " h1.schedule-name").html(UCFirst(schedule.name));

    FIREBASE_DEVICE_DATA_OBJ.child(device.mac).child("widgets").once("value", function (data) {

        // Grab the widget definitions for this device from the database...
        var widgets = data.val();

        // So we had to do some krazy stuff here to sort the widgets by their "z" value.
        // First, since the widgets are an object, we have to pump the object key and the object into an
        // array, as an array. Then the array could be sorted by a sort function.
        // Then, they are re-converted back into an object for iteration.
        var aWidgets = [];
        for (var q in widgets) {
            aWidgets.push([q, widgets[q]]);
        }

        // Sort the temporary widgets array.
        aWidgets.sort(function (a, b) {

            aZ = a[1].z || 0;
            bZ = b[1].z || 0;

            if (aZ < bZ) return -1;
            if (bZ < aZ) return 1;
            return 0;
        });

        // Turn the widgets array back into an object.
        var sWidgets = {};
        for (var o in aWidgets) sWidgets[aWidgets[o][0]] = aWidgets[o][1];

        // Iterate through all the widgets for DOM injection...
        for (var i in sWidgets) {

            // This is for a color swatch. Not used by all widgets: only those who have a "hue", "sat", and "bri" definition.
            var swatch = {};


            // Ensure we have the proper fields:

            if (!widgets[i].path) {
                throw new Error("A 'path' property is required for widget '" + i + '".');
            }

            if (!widgets[i].type) {
                throw new Error("A 'type' property is required for widget '" + i + '".');
            }

            if (!widgets[i].info) {
                throw new Error("An 'info' property is required for widget '" + i + '".');
            }

            if (!widgets[i].name) {
                throw new Error("A 'name' property is required for widget '" + i + '".');
            }

            // The widget data path (e.g. what data will the widget change in the database?)
            var path = widgets[i].path.split(/\//g); // Split by '/'

            var REF = '';

            if (path.length > 1) {

                for (var n in path) {

                    if (path[n] == '*') {
                        break;
                    }
                    else {
                        REF += "/" + path[n];
                        path[n] = null;
                    }

                } // End for()

            } // End if()

            // Note, this immediately run anonymous function is passed the widget key and the path,
            // so that the key and path can be passed by value and retained for callbacks.
            (function (i, path) {

                // We have to determine if the path is an object or the value itself to be altered:
                var pathRef = (path.length <= 1) ? FIREBASE_USER_DATA_OBJ.child(device.mac) : FIREBASE_USER_DATA_OBJ.child(device.mac + "/" + REF);

                // Grab the data from the pathRef Firebase reference:
                // Note this function is bound with this = i (e.g. the widget key)
                pathRef.once("value", function (data) {

                    // The references we need to change.
                    // For single values this array will hold a single object.
                    var REFS = [];

                    // So we don't get confused about variable names
                    var i = this;

                    var paths = data.val();

                    if (path.length <= 1) { // We have a 'value' to be changed, not an object

                        var obj = {};

                        obj.path = pathRef;
                        obj.delta = 0;
                        obj.title = UCFirst(pathRef.child(path[0]).name());

                        obj.set = path[0]; // REFS[x].set is the value to be changed when the widget changes value!

                        REFS.push(obj);

                    }
                    else {

                        // Loop through each independent path:
                        for (var k in paths) {

                            var obj = {};

                            obj.path = pathRef + "/" + k;
                            obj.delta = k;
                            obj.title = UCFirst(pathRef.name());
                            REFS.push(obj);

                        }

                    } // End if/else block

                    // Loop through all the path references
                    for (var r in REFS) {

                        // Placeholder for the swatches, if applicable
                        swatch[r] = {};

                        if (path.length > 1) { // We have a multi-path widget:

                            for (var x in path) {
                                if (path[x] != null && path[x] != "*" && x != path.length - 1) {
                                    REFS[r].path += "/" + path[x];
                                }
                                if (x == path.length - 1) {
                                    REFS[r].set = path[x]; // REFS[x].set is the value to be changed when the widget changes value!
                                    // In this case, it's the last portion of the path.
                                }
                            }

                        } // End if block

                        REFS[r].path += "/";

                        // Append a container for the widgets, if we haven't done so on a previous iteration
                        if (!$('#delta-' + r).length) {
                            $(".widgets-wrapper").append('<div class="widget-container" id="delta-' + r + '"></div>');
                        }

                        // Append a wrapper for the widget for this "delta" or widget group.
                        if (!$("#" + device.name + "-" + REFS[r].delta).length) {

                            $('.widgets-wrapper #delta-' + r)
                                .prepend('<div data-content-theme="b" data-role="collapsible" data-collapsed="true" id="' + device.name + "-" + REFS[r].delta + '"></div>');

                            $("#" + device.name + "-" + REFS[r].delta)
                                .append('<h3 class="ui-bar-b">' + REFS[r].title + ((REFS.length > 1) ? " " + REFS[r].delta : "" ) + '</h3>');
                        }

                        // Give the widget a header, and some info.
                        $("#" + device.name + "-" + REFS[r].delta)
                            .append('<div></div><h3>' + UCFirst(widgets[i].name) + '</h3>' +
                            '<p><i class="fa fa-info"></i>' + widgets[i].info + '</p>' +
                            '<div class="widget-wrapper-' + i + '"></div></div>');

                        // Load the widget from the '/widgets' directory
                        // Note this function is bound to an array [i, r] to maintain the
                        // widget key (i) and widget delta (r)
                        $("#" + device.name + "-" + REFS[r].delta + ' .widget-wrapper-' + i).load(WIDGETS_DIRECTORY + "/" + widgets[i].type + ".html", function (data) {

                            var i = this[0];
                            var r = this[1];

                            // Create the object in jQuery Mobile
                            $("#" + device.name + "-" + REFS[r].delta + ' .widget-wrapper-' + i).trigger("create");

                            // Grab the widget, that is, since we overrode the 'this' variable
                            var e = $("#" + device.name + "-" + REFS[r].delta + ' .widget-wrapper-' + i + ' .widget');

                            // Set the widget's HTML attributes
                            $(e).attr("name", i + "-" + REFS[r].delta);
                            $(e).attr("id", "widget-" + i + "-" + REFS[r].delta + '-' + i);
                            $(e).attr("data-highlight", true);
                            $(e).attr("min", widgets[i].min);
                            $(e).attr("max", widgets[i].max);
                            $(e).attr("step", widgets[i].step);
                            $(e).addClass(i + " delta-" + r);
                            $(e).addClass("z-" + widgets[i].z);

                            $(e).change(function () {

                                var i = this[0];
                                var r = this[1];

                                var value = $(e).val();

                                FIREBASE_SCHEDULES_OBJ.child(schedule.key).once("value", function (data) {

                                    var sch = data.val();

                                    if(!sch.setting_value) sch.setting_value = [];
                                    if(!sch.setting_path) sch.setting_path = [];

                                    console.log(sch);

                                    console.log(encodeURIComponent(device.mac));
                                    var schPath = REFS[r].path.split(encodeURIComponent(device.mac))[1].replace(/^\/|\/$/g, '') + "/" + REFS[r].set;

                                    var index = -1;

                                    if(sch.setting_path.indexOf(schPath) > -1) {
                                        index = sch.setting_path.indexOf(schPath);
                                        sch.setting_path[index] = schPath;
                                        sch.setting_value[index] = value;
                                    }
                                    else {
                                        sch.setting_path.push(schPath);
                                        sch.setting_value.push(value);
                                    }

                                    FIREBASE_SCHEDULES_OBJ.child(schedule.key).update(sch, function () {
                                        console.log("HERE");
                                    });

                                }.bind(this));

                            }.bind([i, r])); // End $(e).change()

                            // The widget has defined itself as part of a swatch
                            if (widgets[i].swatch) swatch[r][i] = $(e);

                            // Set the current value as default slider value...
                            // Using "on" for 2-way data binding
                            new Firebase(REFS[r].path + REFS[r].set).once("value", function (data) {

                                $(e).val(data.val().toString());

                                if ($(e).attr("data-type") == "range") $(e).slider().slider("refresh");

                                // If we have all three required swatch fields, build the swatch...
                                if (swatch[r].hue && swatch[r].sat && swatch[r].bri)
                                    buildSwatch(swatch[r], "#" + device.name + "-" + REFS[r].delta + ' .widget-wrapper-' + i);

                            });

                            // If the data is changed in Firebase, update it client-side as well:
                            new Firebase(REFS[r].path).on("value", function (data) {
                                var val = data.val();

                                for (var m in val) {
                                    if (m == REFS[r].set) {
                                        $(e).val(val[m]).trigger("change");
                                        if ($(e).attr("data-type") == "range") $(e).slider().slider("refresh");
                                    }
                                }

                            });

                        }.bind([i, r])); // End $.get()


                    } // End for(var r in REFS)

                }.bind(i));

            })(i, path); // End Anon-Function

        } // End for(widgets)

        $('.widgets-wrapper').trigger("create");


    });

    /**
     * Builds a color "swatch" so the user can see the results of the values changed.
     * @param swatch    - The "swatch" object
     * @param container - The container the "swatch" object will be appended to.
     */
    function buildSwatch(swatch, container) {

        // Load the swatch widget
        $("<div>").load(WIDGETS_DIRECTORY + "/color-swatch.html", function () {

            $(container).append($(this));

            var swatchElem = this;

            for (var i in swatch) { // Set the swatches background color

                $(this).find(".color-swatch").css("background-color", "hsl(" + ($(swatch.hue).val() / 182.04) + "," + ($(swatch.sat).val() / 2.55) + "%," + ($(swatch.bri).val() / 2.55) + "%)");


                // Change the background color on slider change:
                $(swatch[i]).on("change", function () {
                    $(swatchElem).find(".color-swatch").css("background-color", "hsl(" + ($(swatch.hue).val() / 182.04) + "," + ($(swatch.sat).val() / 2.55) + "%," + ($(swatch.bri).val() / 2.55) + "%)");
                });
            }

        });

    } // End buildSwatch()

} // End injectWidgets
