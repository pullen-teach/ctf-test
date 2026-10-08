# Mission 4: Decoder ring

```
cd ~/mission4
cat message.b64
```{{exec}}

It looks like gibberish, but it is not encrypted. It is **encoded** with base64:
a way of writing any data using only letters, digits, `+`, `/` and `=`.
There is no secret key. Anyone can decode it.

<br>

<details><summary>Hint</summary>

When you do not know an option, ask the tool: `base64 --help`

</details>
