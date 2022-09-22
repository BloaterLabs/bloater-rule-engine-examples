# Examples

Examples of how to use the Bloater Rule Engine. Initial examples will be for automating questing with more coming in near future.

# Install

Either clone this repository or you can use examples in here as a starting place.

## Install Dependencies

Run `npm install` to install dependencies. Currently the only dependencies you would need to add if doing on your own would be `bloater-rule-engine` and `ethers`.

## Create config

Using the example-config.json as an example edit the config to fit your needs. Currently will likely only need to edit your address. Your private key will be requested on the first run of the quest and will then be encrypted with the password you give at the same time.

## Edit example

Copy the example you want to use and make sure the config file is pointed at the location you just created.

## Run 

If you are just editing the example in the examples folder you can run in root of project like so.

`node ./examples-js/dfk-start-complete-quests.js`