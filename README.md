# eurydice

Eurydice is a half-baked programming language disguised as a dice engine. Its syntax is designed to be ergonomic for dice rolls while still remaining reasonably self-consistent.

For example:
```
> d20

9
```
calls the builtin `d` (dice roll) function with the argument `20`. Functions with only one argument don't require parentheses.

```
> d[1, 4, 5]

4
```
calls `d` with the array argument `[1, 4, 5]`, defining the faces of the die.

Rolling multiple dice can be done with:
```
> 5d20

[9, 20, 14, 4, 8]
```
which evaluates the expression `d20` 5 times and stores the results in an array.

You can sum these up using the summation operator `...`:
```
> ...5d20

55
```

There are a variety of mathematical operators available, currently `+`, `-`, `*`, `/`, `**`, and `%`:

```
> d20 + 20

29
```

There are also Boolean operators. They work on numbers as well--0 is false and 1 is true.

```
> 5(d20 > 10)

[0, 1, 1, 0, 0]
```

This allows the `&` operator to double as "maximum" and `|` to double as "minimum":
```
> 3 & 6

3

> 3 | 6

6
```

Sometimes, anonymous functions can come in handy. Take, for example, the built-in "reroll" function, which keeps rolling a die until a specified condition is true:

```
> reroll(@ -> d20, @x -> x % 3 = 0)

9
```

## Trying it out

Eurydice is something I quickly put together for fun, and there are still a ton of rough edges and a lack of documentation. Let me know if this is something you'd be interested in using!

To start, install the dependencies:
```bash
npm run install
```

then start the interactive prompt:
```
npm run interactive
```