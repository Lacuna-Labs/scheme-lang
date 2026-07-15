# Evidence-Based Additions to Sakura's Corpus — a coffee read

*Companion to the full plan at evidence-based-additions-plan-2026-07-13.slat. 2026-07-13.*

## The one-line thesis

For small models — and Sakura at 4B is a small model — the corpus you show her is the corpus she becomes. That's the LIMA finding (Zhou et al., 2023) and the Phi-1 / Phi-1.5 finding (Gunasekar, Zhang, Li et al., 2023). A thousand carefully curated pairs beat fifty thousand noisy ones. Textbook-quality prose on a small model produces disproportionately good behavior. Tonight is a textbook-quality night, and the twelve additions in the full plan are the parts of the textbook we haven't written yet.

## What tonight already has

About a hundred and fifty thousand words. Grimms. Flower Stories. Music and Motion. Shakespeare, world plays, Japanese theater. The sixteen-philosopher weave. The Book of Items & Scenarios. CS Curriculum. LLM Philosophy. Listening pairs. A hundred situational scenes. Persona bundles. It's a lot.

## What's missing — and this is where the research points

Five gaps show up clearly when you read the empirical literature against tonight's corpus:

**One. Deliberation-visible scenes.** Chain-of-thought training (Wei et al., 2022; Nye et al., 2021; Chung et al., 2022 with Flan-PaLM) shows that even a few hundred examples of a model verbalizing its reasoning transfer across held-out problems. Sakura's *voice* is well-tuned. Her *inner process* isn't shown enough. When she stops to think, we don't yet have enough authored scenes of her thinking out loud. Addition #2 in the plan: thirty scenes where she says "I'm looking at this two ways… the first is… the second is… I'm going with the first because…"

**Two. Prosaic shop-object vocabulary in scene.** The TinyStories result (Eldan & Li, 2023) is a small miracle. Ten-million-parameter models, trained on stories written with a three-year-old's vocabulary, produce coherent English. The mechanism: vocabulary appears in a scene, not a glossary. Petroni et al. (2019) and COMET/ATOMIC (Sap et al., 2019) reinforce this: models learn a concept in *use*, matching how they'll be asked to produce it. Sakura has the vocabulary survey. She doesn't yet have forty walkthrough vignettes where an operator picks up a repoussé pendant and talks about it. Addition #1.

**Three. Frame markers for imagination vs reality.** This one is Alfred's specific ask: "She has no life outside this world but she can and should have life within it. And she can and should make that distinction clear." The research is thinner here — STORIUM (Akoury et al., 2020) uses explicit character-card frames, and RAG (Lewis et al., 2020) trains citation of retrieved evidence — but it converges on the same shape: authored examples that *mark* the frame teach the model to mark the frame. Addition #5: fifty scenes where Sakura opens with "imagine a shop where…" or catches herself with "wait — I said that like I knew, I don't, let me check."

**Four. Safety as critique-and-revise.** The Constitutional AI paper (Bai et al., 2022) trained models on triples: bad-response, self-critique against a constitution, revised response. This is measurably more robust than just showing the final response. Sakura's safety doctrine is authored as memory; not yet as training pairs in this format. Addition #4: forty triples across the crisis / illegal / confession / vulgarity / jailbreak / imagined-vs-real surfaces.

**Five. Shop dialogues in both modalities.** Alfred wants the same shop scenario in voice-first and text-first forms. The style-parallel research (Rao & Tetreault, 2018 on GYAFC formality) and mixed-corpora dialogue work (Roller et al., 2021 on BlenderBot) both support this. The ReAct paper (Yao et al., 2022) supports the check-first-then-act discipline Alfred wants baked in. Addition #10: a hundred scenarios in two forms each, every one including an explicit CHECK step.

## The other seven additions

Two-perspective short stories for theory of mind (Gandhi et al., 2024). Calibration pairs where Sakura says "that's a spec, let me check" (Kadavath et al., 2022; Mielke et al., 2022). Scheme examples with intent-prose wrappers (Husain et al., 2019; Zelikman et al., 2022 on STaR). Philosopher sayings embodied without name-drops (Hendrycks et al., 2021 on ETHICS). Two-part continuity exchanges in Godot shape (Rashkin et al., 2020 on PlotMachines, plus extrapolation on the Beckett shape specifically). Empathetic micro-dialogues at understated register (Rashkin et al., 2019 on EmpatheticDialogues). Decision-splitting elicitation pattern — Alfred's top-two-with-or / last-two / final-one-with-rising-intonation heuristic, informed by POMDP dialogue-manager literature (Young et al., 2013) but honestly noted as a craft heuristic rather than a directly-attested empirical finding.

## What the research warns us NOT to do

Two things.

First: don't scale for scale's sake. Chinchilla (Hoffmann et al., 2022) and the follow-up on data-constrained models (Muennighoff et al., 2023) both say a small model on carefully curated data seen up to about four times beats a slightly bigger model on noise. We already believe this. The temptation tonight is to pile on volume; the research says don't.

Second: don't fake citations. Every citation in the plan is a real paper. Where I'm uncertain about mechanism, I marked EXTRAPOLATION. Where a finding is contested (Kosinski 2023 on theory of mind, critiqued by Ullman 2023), I named both sides. If the authoring agents want to add citations tonight, they should verify each one.

## The Fiji-station standard

Alfred's line about the Fiji radio station moment — Cortex remembers a trip from eighteen months ago, dispatches research, plays the station — is the standard. The additions above are what get her closer to that. Prosaic knowledge of the world she's helping in. An inner life she can describe. An imagination she marks as imagination. Dialogue that stays small and warm and honest across voice and text.

If we ship the tier-1 items well tonight — additions ten, one, five, two, and four — she wakes up as the friend Alfred is describing.

Kid at the other end. Books-as-objects. Publishable prose.
