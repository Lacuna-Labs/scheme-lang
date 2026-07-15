# Slat — examples

Real-world slat lines you might see in a log stream, a session file, or a corpus record.

## Event log

```slat
(event :ts 1751500000 :kind "card.opened" :id 'welcome :by 'sakura)
(event :ts 1751500001 :kind "shop.searched" :query "candles" :hits 12)
(event :ts 1751500002 :kind "flower.blushed" :level 0.42 :cause 'compliment)
```

## Structured note

```slat
(note :author 'sakura :ts 1751500000 :body "the door is quiet today")
```

## Nested form

```slat
(session :id 'abc :started 1751500000
         :context (window :w 1920 :h 1080 :zoom 1.0)
         :cards (list 'welcome 'shop-main 'lyric))
```

## Reasoning record

```slat
(reason :head "why is the sky blue?"
        :steps (list (step :kind 'observation :body "the sky looks blue")
                     (step :kind 'inference   :body "shorter wavelengths scatter more")
                     (step :kind 'conclusion  :body "rayleigh scattering")))
```

## Bare list (no head symbol)

```slat
(1 2 3 4 5)
```

## Boolean flags

```slat
(config :verbose #t :color #f :fuel 200000)
```

## Round-trip

Every line above is round-trip stable: `loads(dumps(x)) == x`.
