# Vaillant Efficiency

Helps to optimize duration of the cycle length of Vaillant heating units through [ebusd](https://github.com/john30/ebusd).

**! Important: this software is early alpha work-in-progress and not ready for production - USE AT YOUR OWN RISK !**

**This project is a private endeavour and not an official Vaillant project. It is not associated with Vaillant in any way.**

## Overview

I am developing this tool to fix some shortcomings of the Vaillant controller.
In particular the controller faces problems during periods of warmer outside
temperatures leading to very short heating cycle length of heat pumps etc.

I am developing this in my free time so there aren't any guarantees this will
ever be ready for production or feature complete.

## Environment and Dependencies

- Recommended environment is a Debian (or one of its derivatives) Linux OS, e.g. Raspbian on Raspberry PI.
- Packages node (18+), git, [ebusd](https://github.com/john30/ebusd)

## Installation

- Install required dependencies, make sure `ebusctl` is accessible by the user which runs this process
- Clone this git repo
- Run `npm i && npm run build` within the project's root

## Configuration

- Make a copy of file `.env.example` named `.env` (inside root folder of project), edit it and adapt its values to meet your setup

# Running

`node dist/controller.js`
