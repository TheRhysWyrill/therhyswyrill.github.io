---
layout: default
title: "The Numbers"
permalink: /numbers/
position: 5
seo_description: "The Playability Report in statistics: every review, verdict, word, platform and playtest counted."
---

<div class="numbers-page">

    <div class="numbers-section">
        <h2 class="numbers-section-title">The whole archive, counted</h2>
        {% assign all_reviews = site.pages | where: "layout", "review" %}
        {% assign total = all_reviews.size %}
        {% assign rec_count = all_reviews | where: "verdict", "recommended" | size %}
        {% assign unsure_count = all_reviews | where: "verdict", "not-sure" | size %}
        {% assign notrec_count = all_reviews | where: "verdict", "not-recommended" | size %}
        {% assign total_words = 0 %}
        {% for r in all_reviews %}{% assign r_wc = r.content | strip_html | number_of_words %}{% assign total_words = total_words | plus: r_wc %}{% endfor %}
        {% assign avg_words = total_words | divided_by: total %}
        {% assign total_minutes = total_words | divided_by: 200 %}
        {% assign total_hours = total_minutes | divided_by: 60.0 | round %}
        {% assign rec_pct = rec_count | times: 100 | divided_by: total %}
        {% comment %} Genre count mirrors the homepage: front matter stores
           comma-separated combinations, so split and dedupe to count the
           actual genres behind them. {% endcomment %}
        {% assign genre_combos = all_reviews | map: "genre" | join: "," | downcase | split: "," %}
        {% assign genre_set = "" %}
        {% for combo in genre_combos %}
            {% assign g = combo | strip %}
            {% unless g == "" or genre_set contains g %}
                {% capture genre_set %}{{ genre_set }}|{{ g }}{% endcapture %}
            {% endunless %}
        {% endfor %}
        {% assign genre_count = genre_set | split: "|" | size | minus: 1 %}
        <div class="about-milestones" role="list" aria-label="Archive totals">
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">{{ total }}</span>
                <span class="milestone-label">games reviewed</span>
            </div>
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">{{ total_words }}</span>
                <span class="milestone-label">words written</span>
            </div>
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">{{ avg_words }}</span>
                <span class="milestone-label">avg words per review</span>
            </div>
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">{{ rec_pct }}%</span>
                <span class="milestone-label">recommended</span>
            </div>
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">{{ genre_count }}</span>
                <span class="milestone-label">genres explored</span>
            </div>
            <div class="milestone-card" role="listitem">
                <span class="milestone-num">≈ {{ total_hours }}h</span>
                <span class="milestone-label">of reading aloud</span>
            </div>
        </div>
    </div>

    <div class="numbers-section">
        <h2 class="numbers-section-title">Verdicts</h2>
        {% assign rec_pct_exact = rec_count | times: 100.0 | divided_by: total %}
        {% assign unsure_pct = unsure_count | times: 100.0 | divided_by: total %}
        {% assign notrec_pct = notrec_count | times: 100.0 | divided_by: total %}
        <div class="numbers-bars">
            <div class="numbers-bar-row">
                <span class="numbers-bar-label">✓ Recommended</span>
                <div class="numbers-bar-track"><div class="numbers-bar-fill numbers-bar-fill--rec" style="width: {{ rec_pct_exact }}%;"></div></div>
                <span class="numbers-bar-count">{{ rec_count }} · {{ rec_pct_exact | round }}%</span>
            </div>
            <div class="numbers-bar-row">
                <span class="numbers-bar-label">– Not sure</span>
                <div class="numbers-bar-track"><div class="numbers-bar-fill numbers-bar-fill--unsure" style="width: {{ unsure_pct }}%;"></div></div>
                <span class="numbers-bar-count">{{ unsure_count }} · {{ unsure_pct | round }}%</span>
            </div>
            <div class="numbers-bar-row">
                <span class="numbers-bar-label">✗ Not recommended</span>
                <div class="numbers-bar-track"><div class="numbers-bar-fill numbers-bar-fill--notrec" style="width: {{ notrec_pct }}%;"></div></div>
                <span class="numbers-bar-count">{{ notrec_count }} · {{ notrec_pct | round }}%</span>
            </div>
        </div>
    </div>

    {% assign year_groups = all_reviews | group_by_exp: "r", "r.date | date: '%Y'" | sort: "name" %}
    {% assign max_year_count = 1 %}
    {% for g in year_groups %}{% if g.size > max_year_count %}{% assign max_year_count = g.size %}{% endif %}{% endfor %}
    <div class="numbers-section">
        <h2 class="numbers-section-title">Reviews per year</h2>
        <div class="backlog-activity numbers-years" role="img"
             aria-label="Reviews written per year: {% for g in year_groups %}{{ g.name }}: {{ g.size }}{% unless forloop.last %}, {% endunless %}{% endfor %}">
            {% for g in year_groups %}
            <div class="activity-col">
                <span class="activity-count">{{ g.size }}</span>
                <div class="activity-track"><div class="activity-bar" style="height: {{ g.size | times: 100 | divided_by: max_year_count }}%;"></div></div>
                <span class="activity-year">{{ g.name }}</span>
            </div>
            {% endfor %}
        </div>
    </div>

    <div class="numbers-section">
        <h2 class="numbers-section-title">Platforms covered</h2>
        {% assign platform_groups = all_reviews | group_by: "platform" | sort: "size" | reverse %}
        {% assign max_platform = platform_groups.first.size %}
        <div class="numbers-bars">
            {% for g in platform_groups %}
            <div class="numbers-bar-row">
                <span class="numbers-bar-label" title="{{ g.name }}">{{ g.name }}</span>
                <div class="numbers-bar-track"><div class="numbers-bar-fill" style="width: {{ g.size | times: 100.0 | divided_by: max_platform }}%;"></div></div>
                <span class="numbers-bar-count">{{ g.size }} review{% if g.size != 1 %}s{% endif %}</span>
            </div>
            {% endfor %}
        </div>
    </div>

    <div class="numbers-section">
        <h2 class="numbers-section-title">Genres</h2>
        {% assign genre_groups = all_reviews | group_by: "genre" | sort: "size" | reverse %}
        <div class="numbers-pills">
            {% for g in genre_groups limit: 10 %}
            <span class="numbers-pill"><strong>{{ g.name }}</strong> × {{ g.size }}</span>
            {% endfor %}
        </div>
    </div>

    <div class="numbers-section">
        <h2 class="numbers-section-title">Eras played</h2>
        {% assign decade_groups = all_reviews | group_by_exp: "r", "r.release_year | divided_by: 10 | times: 10" | sort: "name" %}
        <div class="numbers-pills">
            {% for g in decade_groups %}
            <span class="numbers-pill"><strong>{{ g.name }}s</strong> × {{ g.size }}</span>
            {% endfor %}
        </div>
    </div>

    {% assign earliest = all_reviews | sort: "date" | first %}
    {% assign latest = all_reviews | sort: "date" | last %}
    {% assign longest = nil %}
    {% assign longest_w = 0 %}
    {% for r in all_reviews %}
        {% assign r_wc = r.content | strip_html | number_of_words %}
        {% if r_wc > longest_w %}{% assign longest_w = r_wc %}{% assign longest = r %}{% endif %}
    {% endfor %}
    {% assign month_groups = all_reviews | group_by_exp: "r", "r.date | date: '%Y-%m'" | sort: "size" | reverse %}
    {% assign busiest = month_groups.first %}
    {% assign busiest_parts = busiest.name | split: "-" %}
    {% assign month_names = "January,February,March,April,May,June,July,August,September,October,November,December" | split: "," %}
    {% assign busiest_m = busiest_parts[1] | plus: 0 %}
    {% assign busiest_idx = busiest_m | minus: 1 %}
    <div class="numbers-section">
        <h2 class="numbers-section-title">Records</h2>
        <div class="numbers-records">
            <div class="numbers-record">
                <span class="numbers-record-kicker">Longest review</span>
                <p class="numbers-record-value"><a href="{{ longest.url | relative_url }}">{{ longest.game_title }}</a></p>
                <p class="numbers-record-meta">{{ longest_w }} words</p>
            </div>
            <div class="numbers-record">
                <span class="numbers-record-kicker">Busiest month</span>
                <p class="numbers-record-value">{{ month_names[busiest_idx] }} {{ busiest_parts[0] }}</p>
                <p class="numbers-record-meta">{{ busiest.size }} reviews published</p>
            </div>
            <div class="numbers-record">
                <span class="numbers-record-kicker">First review</span>
                <p class="numbers-record-value"><a href="{{ earliest.url | relative_url }}">{{ earliest.game_title }}</a></p>
                <p class="numbers-record-meta">{{ earliest.date | date: "%-d %B %Y" }}</p>
            </div>
            <div class="numbers-record">
                <span class="numbers-record-kicker">Latest review</span>
                <p class="numbers-record-value"><a href="{{ latest.url | relative_url }}">{{ latest.game_title }}</a></p>
                <p class="numbers-record-meta">{{ latest.date | date: "%-d %B %Y" }}</p>
            </div>
            <div class="numbers-record">
                <span class="numbers-record-kicker">Most covered platform</span>
                <p class="numbers-record-value">{{ platform_groups.first.name }}</p>
                <p class="numbers-record-meta">{{ platform_groups.first.size }} reviews</p>
            </div>
            <div class="numbers-record">
                <span class="numbers-record-kicker">Signature genre</span>
                <p class="numbers-record-value">{{ genre_groups.first.name }}</p>
                <p class="numbers-record-meta">{{ genre_groups.first.size }} reviews</p>
            </div>
        </div>
    </div>

    <div class="numbers-section numbers-compat">
        <h2 class="numbers-section-title">Playability testing</h2>
        <p class="numbers-lead">Live totals from the Is It Playable? compatibility sheets, counted across twelve platform tabs.</p>
        <div class="compat-tested-bar" aria-live="polite">
            <span class="compat-tested-text" id="numbers-tested-text">Counting tested games…</span>
            <div class="compat-tested-track"><div class="compat-tested-fill" id="numbers-tested-fill" style="width: 0%;"></div></div>
        </div>
    </div>

    <script src="/assets/js/tested-counter.js" defer></script>
    <script>
    (function () {
        function render(d) {
            if (!d || (!(d.tested > 0) && !(d.backlog > 0))) return;
            var t = d.tested + d.backlog;
            var pct = t > 0 ? Math.round(d.tested / t * 100) : 0;
            var el = document.getElementById('numbers-tested-text');
            var fill = document.getElementById('numbers-tested-fill');
            if (el) el.innerHTML = '<strong>' + d.tested.toLocaleString('en-GB') + '</strong> games tested &nbsp;·&nbsp; '
                + d.backlog.toLocaleString('en-GB') + ' still to be tested &nbsp;·&nbsp; ' + d.platforms.length + ' platforms';
            if (fill) fill.style.width = pct + '%';
        }
        document.addEventListener('compat-tested-count', function (e) { render(e.detail); });
        if (window.__compatTestedDetails) render(window.__compatTestedDetails);
    })();
    </script>

</div>
