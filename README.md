# Hue Control
![screenshot](https://github.com/liamreoch/gnome-shell-extensions-hue-lights/blob/main/screenshots/settings.png)

## Gnome shell extension
Hue Control allows you to switch rooms on and off with a connected Hue Bridge

This was built to provide a very simple toggle to allow you to switch lights on.
The intention is to keep the interface clear and following Gnome guidelines.

## Features
- Autodetect bridge
- Set default room (for main menu control)
- Control other rooms in the house
- Delete bridge connection

## Future plans
- Brightness slider
- Granular light control for each room
- Colour selection

I may consider adding support for other light systems, though I want to avoid overcrowding this extension.

I want it to do one thing well.

## Development notes

### Local testing
If you're planning on making contributions, edits, etc and you need to test it locally:

To enable the plugin for development, move the directory to the extensions directory:

`~/.local/share/gnome-shell/extensions/`

As extension requires schema for values, you will need to compile the gschema: 

Move into the extension directory:

`cd huecontrol@reoch.net`

Then compile:

`glib-compile-schemas schemas/`

Finally, to enable the extension:

`gnome-extensions enable huecontrol@reoch.net`

### Translations:

Any assistance you can provide would be greatly appreciated.

Create directory for new language (this is Spanish)

`mkdir -p locale/es/LC_MESSAGES`

Create po file

`msginit --locale=es --input=huecontrol.pot --output-file=locale/es/LC_MESSAGES/huecontrol.po`

Using poEdit (or similar), add translations

Generate binary .mo file

`msgfmt locale/es/LC_MESSAGES/huecontrol.po -o locale/es/LC_MESSAGES/huecontrol.mo`
