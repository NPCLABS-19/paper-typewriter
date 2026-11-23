"""Build the daily deck from the official WordNet 3.0 data files.
Usage: python scripts/build-vocabulary.py PATH/WordNet-3.0 assets/dfw/words.json
Requires wordfreq (used to rank headwords, not shipped to the browser).
"""
import json, random, re, sys
from pathlib import Path
from wordfreq import zipf_frequency

ROOT = Path(sys.argv[1]); OUTPUT = Path(sys.argv[2]); RNG = random.Random(20261123)
EDITORIAL = '''
inchoate|adjective|Only partly formed or developed.|The idea was still inchoate, but she could already tell it would change the ending.
liminal|adjective|At a threshold or in an in-between state.|The station at dawn had a liminal quiet, as if the day had not quite begun.
perspicacious|adjective|Quick to notice or understand what others miss.|Her perspicacious reading caught the difference between an excuse and a reason.
aporia|noun|An unresolved doubt or a point where reasoning reaches an impasse.|The final question left the debate in aporia.
prolepsis|noun|The anticipation and answering of a possible objection.|His opening paragraph used prolepsis to address the most obvious counterargument.
ineffable|adjective|Too great, intense, or elusive to express in words.|He felt an ineffable relief when the light in the kitchen came on.
rebarbative|adjective|Unpleasant or off-putting in manner or appearance.|A rebarbative welcome made the otherwise quiet inn difficult to recommend.
obdurate|adjective|Stubbornly unwilling to change an opinion or course of action.|The director remained obdurate even after the evidence was laid out in full.
gnomon|noun|The part of a sundial that casts the shadow.|A small crack ran from the base of the gnomon to the edge of the sundial.
accretion|noun|A gradual buildup through the addition of layers or parts.|The clutter was an accretion of small objects she thought she might need again.
velleity|noun|A wish too weak to prompt action.|His plan to learn the cello never progressed beyond velleity.
specious|adjective|Plausible at first glance but wrong or misleading.|The proposal rested on the specious claim that speed always saves money.
quotidian|adjective|Ordinary and occurring every day.|The writer was unusually attentive to the quotidian ritual of making tea.
susurrus|noun|A low, soft sound of whispering or rustling.|A susurrus of leaves followed them down the path.
provisional|adjective|Tentative and subject to change.|The first sketch was provisional and could be redrawn once the measurements were in.
fastidious|adjective|Very attentive to detail and hard to please.|A fastidious editor noticed the extra space before the closing quotation mark.
lacuna|noun|A gap or missing part in a text, record, or body of knowledge.|The missing letter left a lacuna in their account of that winter.
peregrination|noun|A journey, especially a long or wandering one.|Their peregrination took them from the coast to a village near the border.
parataxis|noun|Placing clauses or phrases side by side without marking one as subordinate.|The clipped report used parataxis to set one observation next to the next.
ineluctable|adjective|Impossible to escape or avoid.|The meeting moved with ineluctable slowness toward a decision no one liked.
'''.strip()
first = [line.split('|') for line in EDITORIAL.splitlines()]
picked = {}
for part, label in [('noun','noun'),('verb','verb'),('adj','adjective'),('adv','adverb')]:
    with (ROOT / 'dict' / ('data.' + part)).open(encoding='latin1') as f:
        for line in f:
            if not line[0].isdigit() or ' | ' not in line: continue
            header, gloss = line.strip().split(' | ',1)
            definition, *_ = gloss.split('; "',1)
            if not 12 <= len(definition) <= 155: continue
            if re.search(r'(?:\bvulgar\b|offensive|ethnic slur|derogatory|obscene|sexual|derogation|racial slur)',gloss,re.I): continue
            examples = re.findall(r'"([^"\n]+)"',gloss)
            fields = header.split(); count = int(fields[3],16)
            for i in range(count):
                term = fields[4+i*2]
                if not re.fullmatch(r'[a-z][a-z-]{3,19}',term): continue
                if term in {row[0] for row in first}: continue
                frequency = zipf_frequency(term,'en')
                if not 1.35 <= frequency <= 4.65: continue
                stem = term[:-1] if term.endswith('e') else term
                use = next((e for e in examples if 4<=len(e.split())<=23 and re.search(r'\b(?:'+re.escape(term)+r'|'+re.escape(stem)+r'(?:s|es|ed|ing|ly))\b',e,re.I)),None)
                if not use: continue
                if re.search(r'\b(?:bitch|cunt|fuck|nigger|niggard|piss|bastard|shit|whore|faggot|slut)\w*\b',term+' '+definition+' '+use,re.I): continue
                score=frequency+(.28 if label in ('adjective','verb') else 0)-abs(len(use.split())-9)*.022
                if term not in picked or picked[term][0] < score:
                    picked[term]=(score,[term,label,definition[0].upper()+definition[1:].rstrip('.')+'.',use[0].upper()+use[1:]+('' if use[-1] in '.?!' else '.')])
selected = [row for _,row in sorted(picked.values(),reverse=True)[:7300]]
RNG.shuffle(selected)
items = first + selected
items = items[:len(items)//20*20]
OUTPUT.write_text(json.dumps(items, ensure_ascii=False, separators=(',',':'))+'\n',encoding='utf8')
print(f'{len(items)} words, {len(items)//20} distinct daily decks')
