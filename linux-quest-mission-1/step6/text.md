# Mission 6: Decoder ring

**Difficulty:** Hard · **400 points**

```
cd ~/mission6
cat message.b64
```{{exec}}

It looks like gibberish, but it is not encrypted. It is **encoded** with base64: a way of writing any data using only letters, digits, `+`, `/` and `=`.

There is no secret key. Anyone can decode it.

**Useful command:** `base64`. Use `--help` to discover what they can do.

When you have the flag, record it with `submit` and press **CHECK**.

<br>

<details><summary>Hint</summary>

Read the help for `base64` and look for the option that turns base64 back into normal text.

```
base64 --help
```

The full manual page has even more: `man base64` (press `q` to quit).

</details>
