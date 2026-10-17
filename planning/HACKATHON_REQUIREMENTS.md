# Amazon Developer Hackathon: Build, Ship, Shape — Official Requirements

## Project Requirements
**What to Create:** Entrants must build or significantly update working applications using Amazon developer tools into the following primary tracks (each a “Project”).

### Primary Tracks:
1. **Fire TV:** Eligible projects for this category have to launch a demo-ready app that works on Fire OS or Vega OS. Priority categories: AI-enhanced viewing, sports, fitness, family entertainment, multi-modal UX, and computer vision.
2. **Alexa+:** Build a working Agent Skill or a self-hosted MCP server, implementing MCP spec version (minimum acceptable version is 2025-11-25). Optionally, developers can simulate the Alexa+ experience in a web app using their own agentic tools.
3. **Bee (Wearable AI):** Build a project that connects to data recorded and processed through a Bee device or Apple Watch running Bee software, using Bee's CLI, MCP, or Agent Skills. The demo must show the project using that data to deliver value to a user. Priority use cases: education, developer experience, and personal productivity.
4. **Ring:** A working app or new feature that utilizes Ring APIs, SDKs, simulators, or devices, demonstrated through a simulator or an actual device. Priority categories: access control, business systems, IoT home automation, accessibility, and caretaking.

### Mini Challenges:
- **AWS Builder (Mini Challenge):** Any primary track project that incorporates AWS services (i.e. Amazon Bedrock, AgentCore, Strands SDK, Kiro Crew, SageMaker, etc.) with documented integrations.
  - *Note:* Kiro Crew qualifies on its own as a development tool used during the hackathon — a submission does not need to also call a runtime AWS service (Bedrock, AgentCore, SageMaker, Strands SDK) to count for this mini-challenge.
- **Open Source (Mini Challenge):** Create a new, additional open-source project or contribute to an existing public repository during the hackathon window, alongside a primary track submission. Contributions can be a new repo (with open-source license), a branch, a fork, or a pull request. PRs do not need to be merged; share your forked version if unmerged. Required: contribution URL, project repository URL, GitHub username, and a description of what you did, how it works, and why it matters.

*The Sponsor and Administrator reserve the right to reassign an Project from one Category or Mini Challenge Prize to another if applicable.*

- **Functionality:** The Project's code repository must include clear setup and run instructions, and the Project must be shown functioning in the demonstration video, as depicted in the video, URL and/or expressed in the text description.
- **Platforms:** The demonstration video must show the Project functioning on the platform for which it is intended and which is specified in the Submission Requirements.
- **New & Existing:** Projects must be either newly created by the Entrant or, if the Entrant’s Project existed prior to the Hackathon Submission Period, must have been significantly updated after the start of the Hackathon Submission Period. Entrants must explain how their Project was significantly updated – clearly describe and demo the feature updates during the Submission Period.
- **Third Party Integrations:** If a Project integrates any third-party SDK, APIs and/or data, Entrant must be authorized to use them in accordance with any terms and conditions or licensing requirements of the tool.

---

## Submission Requirements
Submissions to the Hackathon must meet the following requirements:
1. Include a Project built with the required developer tools and meets the above Project Requirements.
2. Include a text description that should explain the features and functionality of your Project.
3. Provide a URL to your code repository for judging and testing on GitHub. The repository must contain all necessary source code, assets, and instructions required for the project to be functional.
4. The repository must be either public and open source by including an open source license file OR private and shared with `testing@devpost.com` and the Amazon team (info below).
   - To share your project with the Amazon team, open your repo’s Settings > Collaborators > Add people and add:
     - `chris-trag`, `knmeiss`, `giolaq`, `anishamalde`, `mosesroth`, `emersonsklar`
   - For public repositories: this license should be detectable and visible at the top of the repository page (in the About section).
5. **For Alexa+, Bee, and Ring:** The repository must demonstrate use of your track's required technology at runtime in your code — imported and actually called (a library import, an app/backend entry point, or a loaded agent/flow/MCP config), not just named in the README. Fire TV is the exception.
   - **Alexa+:** A working Agent Skill or a self-hosted MCP server, implementing MCP spec version 2025-11-25 (or a later version, once confirmed) over Streamable HTTP. Alternatively, entrants may submit a simulated Alexa+ experience instead — built using any AI or agentic tool of their choice, no specific framework, SDK, or MCP-shaped surface required. This alternate path is exempt from the runtime-technology-hook requirement above; the code repository must still include the simulation's source code, and the demo video must clearly show the simulated experience.
6. Include a demonstration video of your Project:
   - Should be less than three (3) minutes. Judges are not required to watch beyond three minutes.
   - Should include footage that shows the Project functioning on the device for which it was built.
   - Must be uploaded to and made publicly visible on YouTube or Vimeo and a link provided in the submission form.
   - Must not include third party trademarks or copyrighted music without permission.
7. Include Product Feedback for each tool, API, or SDK used in your project:
   - Which developer tools, APIs and SDKs did you use and for what?
   - What worked well? (setup, docs, testing, performance, reliability)
   - What needs work? (system errors, missing features, compatibility issues, tool limitations, workarounds)
   - How was your onboarding experience (getting from zero to hello world)
   - Would you build with these devices and services again? Yes/No and why
8. Identify which Primary Track(s) you are submitting your Project into.
9. Identify which Mini Challenge(s) you are participating in:
   - **For AWS Builder (Mini Challenge):** Describe which AWS service(s) you used and how, in your Product Feedback answer.
   - **For Open Source (Mini Challenge):** Provide contribution URL, project repo URL, GitHub username, and description of what you did, how it works, and why it matters.
