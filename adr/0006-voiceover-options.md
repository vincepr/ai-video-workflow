# 0006: Current voiceover options

Status: Accepted
Date: 2026-10-11

## Decision

Keep these options available while testing voices:

| Option | Operator | Use |
| --- | --- | --- |
| [Izwi](https://github.com/izwi-ai/izwi) | Agent | Local voice generation; setup still needed. |
| [Free Voice Reader](https://www.freevoicereader.com/) | User, in browser | Generate and download a voiceover for the agent to use. |
| [TextaVoice](https://www.textavoice.com/male-voice-generator/) | User, in browser | Another browser option for voice comparisons. |
| [ElevenLabs](https://elevenlabs.io) | User, in browser for now | User's preferred option for highest quality. Consider agent API access after choosing a voice, possibly through OpenRouter. |

Use supplied recordings as they are. Align captions and cuts to each recording when comparing voices. Keep audio and exports in ignored media and output folders.

API integration is a later step. Verify that the chosen voice and model are available through the provider before implementing it. Follow ADR 0004 for API costs and credentials.

## Reason

Browser tools let the user test voices now. Izwi offers a candidate for agent-operated generation, and ElevenLabs is the preferred quality target.

## Validation

Before adopting an option, compare a sample using the same script and check pronunciation, pacing, audio quality and intended-use terms. Inspect caption and cut timing after changing a recording. Verify API voice availability and pricing before spending credit.
