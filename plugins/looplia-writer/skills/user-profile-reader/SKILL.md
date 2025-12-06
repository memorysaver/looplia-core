---
name: user-profile-reader
description: Read user profile from workspace and provide personalization context for content analysis and idea generation.
---

# User Profile Reader Skill

Read and interpret user preferences for content personalization.

## What This Skill Does

- Reads `user-profile.json` from workspace
- Scores content relevance to user topics
- Provides personalization context to other skills

## Input

- Path to user-profile.json (default: ~/.looplia/user-profile.json)

## Output

UserProfile object with:
- userId
- topics: Array of { topic, interestLevel (1-5) }
- style: { tone, targetWordCount, voice }

## Relevance Scoring

Calculate relevance score (0-1) by:
1. For each user topic, assign weight = interestLevel / 5
2. Check if content tags/themes match topic (case-insensitive)
3. Sum matched weights / sum total weights
4. Return score between 0 and 1

## Usage

Other skills can invoke this skill to:
- Score content relevance
- Tailor narrative angles to user tone
- Match writing style preferences
