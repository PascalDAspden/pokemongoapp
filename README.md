# Shiny Hunt Guide

A Pokémon GO companion application for tracking upcoming raids, events, and shiny Pokémon that I still need to collect.

The project was built as a personal software development project and is designed to make it easier to identify useful upcoming shiny-hunting opportunities without manually comparing event and raid information against a separate checklist.

## Features

- Track shiny Pokémon that have already been collected
- Show only upcoming shinies that are still needed
- Separate tracking for:
  - Standard Pokémon
  - Shadow Pokémon
  - Dynamax Pokémon
  - Gigantamax Pokémon
- Browse current and upcoming raid Pokémon
- Separate 1-star and 3-star raid filters
- Filter and sort raid targets
- View individual Pokémon details
- Track Pokémon GO events
- Local-time event countdowns
- Persistent checklist storage
- Backup and restore shiny checklist data between devices
- Responsive interface for desktop and mobile use

## Motivation

Pokémon GO regularly rotates raids, events, and featured Pokémon.

I wanted a single application that could answer a simple question:

> **Which upcoming shiny Pokémon are available that I still need?**

Rather than maintaining a separate checklist and manually comparing it against current events, Shiny Hunt Guide combines collection tracking with upcoming Pokémon availability.

## Tech Stack

The application is built using:

- React
- JavaScript
- Vite
- HTML
- CSS
- Browser local storage
- Git / GitHub

Development and testing have also included running the application locally and experimenting with packaging the web application for use on iPhone.

## Shiny Tracking

Users can mark a shiny Pokémon as owned using the checklist interface.

The application stores this information locally so collection progress remains available between sessions.

Different Pokémon forms are tracked independently. For example, owning a standard shiny does not automatically mark its Shadow, Dynamax, or Gigantamax version as collected.

The **Show shinies I need** option then filters upcoming targets against the user's collection.

## Backup and Restore

Checklist data can be exported and restored so that collection progress can be transferred between devices.

This backup contains Shiny Hunt Guide checklist information rather than data imported directly from Pokémon GO.

## Raid Tracking

Raid information can be browsed and filtered to make useful targets easier to identify.

Current filtering includes separate categories for:

- 1-star raids
- 3-star raids
- higher-tier raids
- Shadow Pokémon
- Dynamax Pokémon
- Gigantamax Pokémon

## Events

The application displays relevant Pokémon GO events alongside their start and end times.

Countdowns are shown relative to the user's local time to make upcoming events easier to follow.

## Development

This project has also been an opportunity to work with:

- component-based frontend development
- application state management
- persistent client-side data
- filtering and sorting logic
- responsive UI design
- data modelling
- Git-based version control
- local development workflows
- mobile application testing

I have also used AI-assisted development tools during the project for rapid prototyping, debugging, research, and iteration while reviewing, testing, and maintaining the resulting application locally.

## Running Locally

Clone the repository:

```bash
git clone https://github.com/PascalDAspden/pokemongoapp.git
cd pokemongoapp
