<script lang="ts">
  import PageShell from '$lib/components/PageShell.svelte';
</script>

<PageShell
  title="What is OPTIMAT"
  description="Integrated Open Data Platform for Multimodal Accessible Transportation overview"
  fullWidth={true}
>
  <div class="mx-auto max-w-5xl space-y-8">
    <section class="space-y-3">
      <h2 class="text-2xl font-semibold">Integrated Open Data Platform for Multimodal Accessible Transportation (OPTIMAT) Overview</h2>
      <p class="text-sm text-muted-foreground leading-6">
        OPTIMAT is a behind-the-scenes coordination platform that brings together transportation information from multiple providers into one place.
        OPTIMAT will establish an open data-driven integrated system that provides customizable and timely accessible transit information services
        for individuals with special mobility needs, particularly those who are seniors and people with disabilities, bringing together data sources
        from providers and developing customer-oriented tools.
      </p>
      <p class="text-sm text-muted-foreground leading-6">
        In Stage 1, the prototyping of the open data platform will provide solutions to facilitate collaboration among agencies and organizations,
        mitigate complexity in guiding travelers, and improve data standards to be compatible with a broader range of stakeholders such as technology
        providers, agency operators, and policymakers.
      </p>
      <p class="text-sm text-muted-foreground leading-6">
        OPTIMAT does not replace existing transportation or ride booking services. Instead, it improves how information about those services is shared and accessed.
      </p>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Who is OPTIMAT for?</h3>
      <div class="space-y-3 text-sm text-muted-foreground">
        <div>
          <p class="font-medium text-foreground">Primary users:</p>
          <ul class="list-disc pl-6 space-y-1 leading-6">
            <li>Seniors and people with disabilities who need accessible, reliable transportation</li>
            <li>Riders new to the area</li>
            <li>Riders who use fixed routes whose circumstances have changed and now need accessible options</li>
          </ul>
        </div>
        <div>
          <p>
            <span class="font-medium text-foreground">Secondary users:</span>
            Agency staff who assist riders by phone, text, or web, CBOs, service providers, and other organizations who work with and support primary user groups.
          </p>
        </div>
        <div>
          <p>
            <span class="font-medium text-foreground">Partners:</span>
            Transit agencies, mobility providers, and service organizations that provide TNC services, ADA paratransit, medical transport,
            and other accessible transportation services.
          </p>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">The Problem OPTIMAT Solves</h3>
      <p class="text-sm text-muted-foreground leading-6">Today, transportation information is:</p>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Spread across many systems and websites</li>
        <li>Difficult for riders to navigate</li>
        <li>Time-consuming for staff to explain repeatedly</li>
      </ul>
      <p class="text-sm text-muted-foreground leading-6">Riders may need to contact multiple agencies to understand:</p>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Eligibility</li>
        <li>Service areas</li>
        <li>Trip availability</li>
      </ul>
      <p class="text-sm text-muted-foreground leading-6">
        OPTIMAT brings this information together in one place, so riders and call center staff can quickly compare options and identify the best service for each trip.
      </p>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">How OPTIMAT Works</h3>
      <ol class="list-decimal pl-6 text-sm text-muted-foreground space-y-2 leading-6">
        <li>A rider enters a trip request (destination and time) via a website, app, or by calling.</li>
        <li>OPTIMAT asks eligibility-related questions to identify which services the rider can use and where they can go.</li>
        <li>OPTIMAT generates a list of available transportation options that meet the rider's needs.</li>
        <li>The rider books directly with the provider, using the provider's existing process.</li>
        <li>OPTIMAT informs the system if no provider meets the rider's needs or eligibility, or if booking cannot be completed.</li>
      </ol>
      <p class="text-sm text-muted-foreground leading-6">OPTIMAT does not book trips or dispatch vehicles.</p>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Relationship with One Call, One Click</h3>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>One Call, One Click is the front door for riders who need a call option.</li>
        <li>OPTIMAT ensures staff and riders see accurate, consistent, and up-to-date information because it develops the backend data infrastructure necessary to connect riders to providers.</li>
      </ul>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Benefits for Providers and Transit Agencies</h3>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Reduced staff time spent answering routine eligibility and trip questions</li>
        <li>Fewer phone calls and manual lookups</li>
        <li>Increased rider satisfaction through clearer information</li>
        <li>Improved visibility of services</li>
        <li>Access to real-time information to support planning and decision-making</li>
        <li>Stronger coordination across agencies without changing current booking operations</li>
      </ul>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Data Sharing</h3>

      <div class="space-y-2">
        <p class="text-sm font-medium">OPTIMAT Does Not:</p>
        <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
          <li>Replace transportation or ride booking service</li>
          <li>Change booking or dispatch systems</li>
          <li>Control transit operations or schedules</li>
          <li>Share rider personal information</li>
        </ul>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium">What Data Is Shared?</p>
        <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
          <li>Service information (hours, service area, eligibility rules)</li>
          <li>High-level trip availability and scheduling details (as appropriate)</li>
          <li>Booking information and contact methods</li>
        </ul>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium">What Data Is Not Shared?</p>
        <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
          <li>Personally identifiable rider information (PII)</li>
          <li>Medical or certification documents</li>
          <li>Payment information</li>
          <li>Internal operational data beyond what providers approve</li>
        </ul>
      </div>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Data Privacy and Security</h3>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>All rider data is stripped of personally identifiable information</li>
        <li>Data is stored in a secure environment</li>
        <li>Providers retain control over what data is shared</li>
        <li>Data is used only to improve rider information and system coordination and confirm rider eligibility anonymously</li>
      </ul>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">How Providers Participate</h3>
      <p class="text-sm text-muted-foreground leading-6">Participation begins with understanding what systems providers already use:</p>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Digital scheduling or booking software and systems</li>
        <li>Paper-based processes</li>
        <li>Phone-based reservations</li>
      </ul>
      <p class="text-sm text-muted-foreground leading-6">
        OPTIMAT works with both modern and legacy systems. The goal is not to replace booking tools, but to help systems communicate and share
        essential information in a standardized way. Providers can also help by identifying additional technology needs for future work.
      </p>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Current Project Phase (Stage 1)</h3>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Building and testing the first version of the OPTIMAT prototype</li>
        <li>Working with providers to understand data structures and workflows</li>
        <li>Identifying interoperability needs and challenges</li>
        <li>Ensuring solutions are practical, scalable, and provider-friendly</li>
      </ul>
      <p class="text-sm text-muted-foreground leading-6">This phase is collaborative and exploratory, not mandatory or final.</p>
    </section>

    <section class="space-y-3">
      <h3 class="text-xl font-semibold">Why Existing Trip Planners Fall Short</h3>
      <p class="text-sm text-muted-foreground leading-6">Tools like Google Transit or Transit App:</p>
      <ul class="list-disc pl-6 text-sm text-muted-foreground space-y-1 leading-6">
        <li>Do not fully support paratransit</li>
        <li>Do not handle eligibility-based services</li>
        <li>Do not capture accessible transportation nuances</li>
        <li>Do not include volunteer programs or other mobility providers</li>
      </ul>
      <p class="text-sm text-muted-foreground leading-6">OPTIMAT is designed specifically to address these gaps.</p>
    </section>

    <section class="space-y-3 rounded-lg border border-border/60 bg-card p-4">
      <h3 class="text-xl font-semibold">Key Takeaway for Agencies and Providers</h3>
      <p class="text-sm text-muted-foreground leading-6">
        OPTIMAT is better coordination, not more work. It helps riders find services more easily, reduces repetitive staff tasks,
        and improves system-wide understanding, while allowing agencies and providers to maintain full control over operations and data.
      </p>
    </section>
  </div>
</PageShell>
