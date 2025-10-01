import {
    useState,
    useReducer,
    useEffect,
    useLayoutEffect,
    useContext,
    createContext,
    useRef
} from "react";

import axios from "axios";

const appName = "S'Post ";
const API_BASE_URL = "https://s-post-server.vercel.app/api";

const endpoints = {
    makePost: `${API_BASE_URL}/post/make`,
    likePost: `${API_BASE_URL}/post/like`,
    loadPost: `${API_BASE_URL}/post/load`,
    homePage: API_BASE_URL.replace("api", ""),
    copyPost: `${API_BASE_URL}/post/single`
};

const timerDelay = 200; // ms
const blurDislikes = 100;
const maxPostContentLength = 5000;
const maxAuthorName = 25;
const isLargeScreen = typeof innerWidth == "number" ? (innerWidth >= 600 && innerHeight >= 600) : true

const scrollLap = 50;
const scrolledEnd = ele => {
    if (!ele) return false;
    return (
        ele.scrollTop + ele.clientHeight >= ele.scrollHeight - scrollLap ||
        ele.scrollHeight - scrollLap <= ele.clientHeight
    );
};

function formatTime(timestamp) {
    const date = new Date(parseInt(timestamp));
    const now = new Date();

    const diffSeconds = Math.floor((now - date) / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (date.toDateString() === now.toDateString()) {
        if (diffMinutes < 1) return "Now";
        if (diffMinutes < 60) return `${diffMinutes}min`;
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const period = hours < 12 ? "am" : "pm";
        const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
        const formattedMinutes = minutes.toString().padStart(2, "0");
        return `${formattedHours}:${formattedMinutes}${period}`;
    }

    if (diffDays < 7) {
        const days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"
        ];
        return days[date.getDay()];
    }

    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours < 12 ? "am" : "pm";
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes.toString().padStart(2, "0");
    return `${day}/${month}/${year} ${formattedHours}:${formattedMinutes}${period}`;
}

const currentBarContext = createContext();

const Bar = ({ Content, name }) => {
    const currentBar = useContext(currentBarContext);
    return (
        <div
            className="bar"
            style={{
                display: name === currentBar ? "flex" : "none"
            }}
        >
            {Content}
        </div>
    );
};

const Button = ({ name, click, content }) => {
    const currentBar = useContext(currentBarContext);
    const active = currentBar === name;
    return (
        <button
            className={active ? "nav active-nav clickable" : "nav clickable"}
            name={name}
            onClick={click}
        >
            {content ?? name}
        </button>
    );
};

const Image = ({ src }) => {
    const [loaded, setLoaded] = useState(false);
    const [imgSrc, setImgSrc] = useState(src);

    useEffect(() => {
        let interval;
        if (loaded === "error") {
            interval = setInterval(() => {
                setImgSrc(`${src}?t=${Date.now()}`);
            }, 300);
        }
        return () => clearInterval(interval);
    }, [loaded, src]);

    return (
        <img
            className={
                loaded === true
                    ? "image"
                    : loaded === "error"
                    ? "error-image image"
                    : "loading-image image"
            }
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded("error")}
            src={imgSrc}
        />
    );
};

const ImagePicker = ({ onSelect }) => {
    const [imageUrl, setImageUrl] = useState(null);
    const fileInput = useRef();

    const handleChange = e => {
        const file = e.target.files[0];
        if (file) {
            if (onSelect) onSelect(file);
            const url = URL.createObjectURL(file);
            setImageUrl(url);
            e.target.value = ""; // ✅ reset correctly
        }
    };

    const selectFile = () => {
        if (fileInput.current) {
            setImageUrl(null);
            fileInput.current.click();
        }
    };

    return (
        <div className="imagePicker clickable" onClick={selectFile}>
            <input
                ref={fileInput}
                type="file"
                className="fileInput"
                accept="image/*"
                onChange={handleChange}
                hidden
            />
            {!imageUrl ? (
                <span>Select Image 🖼️</span>
            ) : (
                <Image src={imageUrl} />
            )}
        </div>
    );
};

const Spinner = ({ content, loading = true }) => {
    return loading ? (
        <>
            <div className="spinner"></div>
            <span className="mt-[1rem] text-white font-bold">{content}</span>
        </>
    ) : null;
};

const shortenText = (text, length = 30) => {
    return {
        text: text.length >= length ? `${text.slice(0, length)} ...` : text,
        isShorten: text.length >= length
    };
};

const maxContentToShow = 300;

const Post = ({ post, setPosts }) => {
    const { author, _id, image, createdAt, likes, dislikes } = post;
    const [content, setcontent] = useState(
        shortenText(post.content, maxContentToShow)
    );

    const toggleContent = () => {
        if (content.isShorten) {
            setcontent({ text: post.content, isShorten: false });
        } else {
            setcontent(shortenText(post.content, maxContentToShow));
        }
    };

    const [likeTimer, setLikeTimer] = useState(null);

    const likePost = positive => {
        clearTimeout(likeTimer);
        const timer = setTimeout(async () => {
            const { data } = await axios.post(
                `${endpoints.likePost}?positive=${positive}&_id=${_id}`
            );
            const { liked } = data;
            if (liked) {
                setPosts(posts =>
                    posts.map(p =>
                        p._id === _id
                            ? {
                                  ...p,
                                  likes: positive ? p.likes + 1 : p.likes,
                                  dislikes: !positive
                                      ? p.dislikes + 1
                                      : p.dislikes
                              }
                            : p
                    )
                );
            }
        }, timerDelay);
        setLikeTimer(timer);
    };

    const copyPost = _id => {
        if (navigator.clipboard) {
            navigator.clipboard
                .writeText(`${endpoints.copyPost}?_id=${_id}&type=app`)
                .then(() => {
                    alert("post link copied to clipboard, share link to others");
                })
                .catch(() => alert("Failed to copy link"));
        }
    };

    return (
        <div className={dislikes >= blurDislikes ? "blured post" : "post"}>
            <div className="head">
                <span className="author">{author} </span>
                {navigator.clipboard && (
                    <span onClick={() => copyPost(_id)} className="copy">
                        copy 📍
                    </span>
                )}
            </div>

            {image && image !== "undefined" && <Image src={image} />}
            <div onClick={toggleContent} className="content">
                {content.text}
            </div>
            <div className="feet">
                <span className="date">Post Time: {formatTime(createdAt)}</span>
                <span
                    onClick={() => likePost(true)}
                    className="likes clickable"
                >
                    ♥️{likes}
                </span>
                <span
                    onClick={() => likePost(false)}
                    className="dislikes clickable"
                >
                    👎 {dislikes}
                </span>
            </div>
        </div>
    );
};

const getAuthorName = () => {
    let authorName = localStorage.getItem("authorName");
    if (authorName) authorName = authorName.slice(0, maxAuthorName);
    return authorName || "";
};

const App = () => {
    const [currentBar, setCurrentBar] = useState("post");
    const [postContent, setPostContent] = useState("");
    const [postImage, setPostImage] = useState();
    const [authorName, setAuthorName] = useState(getAuthorName());
    const [posting, setPosting] = useState(false);
    const [posts, setPosts] = useState([]);
    const [loadedPost, setLoadedPost] = useState([]);

    const isMaxContentHitted = () => postContent.length >= maxPostContentLength;

    const postInput = useRef();
    useLayoutEffect(() => {
        const breaks = postContent.split("\n").length;
        if (postInput.current) {
            postInput.current.style.minHeight = breaks >= 3 ? "200px" : "100px";
            postInput.current.style.borderColor = isMaxContentHitted()
                ? "red"
                : "white";
        }
    }, [postContent]);

    const makePost = async () => {
        setPosting(true);
        const postData = {
            createdAt: Date.now(),
            content: postContent,
            author: authorName,
            image: postImage
        };

        const pData = new FormData();
        for (const k in postData) {
            pData.append(k, postData[k]);
        }

        try {
            const { data } = await axios.post(endpoints.makePost, pData);
            const { posted, post } = data;
            if (posted) {
                setPosts(posts => [...posts, post]);
                setLoadedPost(pts => [...pts, post._id]);
                setCurrentBar("post");
                setPostContent("");
                setAuthorName(getAuthorName());
            } else {
                alert(data.message);
            }
        } catch {
            alert("network error - posting failed");
        } finally {
            setPosting(false);
        }
    };

    const postLoadLimit = 20;
    const [loadingPost, setLoadingPost] = useState(false);
    const [fetchTimer, setFetchTimer] = useState(null);

    const fetchPost = async cb => {
        clearTimeout(fetchTimer);
        if (loadingPost) return;
        setLoadingPost(true);

        setFetchTimer(
            setTimeout(async () => {
                try {
                    const { data } = await axios.post(endpoints.loadPost, {
                        limit: postLoadLimit,
                        loadedPost
                    });

                    const { found } = data;
                    let fetchedPost = data.posts.filter(
                        p => !loadedPost.includes(p._id)
                    );

                    if (found && fetchedPost.length) {
                        setPosts(pts => [...pts, ...fetchedPost]);
                        setLoadedPost(pts => [
                            ...pts,
                            ...fetchedPost.map(p => p._id)
                        ]);
                        if (cb) cb();
                    } else if (posts.length === 0) {
                        setTimeout(fetchPost, timerDelay + 100);
                    }
                } catch (err) {
                    console.error("Error loading posts", err);
                    if (posts.length === 0) setTimeout(fetchPost, timerDelay);
                } finally {
                    setLoadingPost(false);
                }
            }, timerDelay)
        );
    };

    const postBar = useRef();

    useEffect(() => {
        localStorage.setItem("authorName", authorName);
    }, [authorName]);

    const [postScrolledEnd, setPostScrolledEnd] = useState(false);
    useEffect(() => {
        if (!postBar.current) return;
        const handler = () => setPostScrolledEnd(scrolledEnd(postBar.current));
        postBar.current.addEventListener("scroll", handler);
        return () => postBar.current?.removeEventListener("scroll", handler);
    }, []);

    useEffect(() => {
        fetchPost();
    }, []);

    return (
        <currentBarContext.Provider value={currentBar}>
            <div className="header">
                <span className="appName">{appName} </span>
                <div className="navs">
                    <Button name="post" click={() => setCurrentBar("post")} />
                    <Button
                        name="composer"
                        click={() => setCurrentBar("composer")}
                    />
                    <Button
                        name="Go Home"
                        click={() => {
                            location.href = endpoints.homePage;
                        }}
                    />
                </div>
            </div>

            <Bar
                name="post"
                Content={
                    <>
                        <h3 className="title">Post</h3>
                        <div className="posts" ref={postBar}>
                            {posts.length ? (
                                posts.map((p, i) => (
                                    <Post
                                        key={p._id || i}
                                        post={p}
                                        setPosts={setPosts}
                                    />
                                ))
                            ) : (
                                <span className="none">
                                    Wait While Post Load ⛔{" "}
                                    <Spinner loading />
                                </span>
                            )}
                        </div>

                        {postScrolledEnd || isLargeScreen ? (
                            <button
                                onClick={() => fetchPost()}
                                className={
                                    !loadingPost
                                        ? "loading-btn"
                                        : "loading-btn inactive"
                                }
                            >
                                {!loadingPost ? "Load More" : "Loading More..."}
                            </button>
                        ) : null}
                    </>
                }
            />

            <Bar
                Content={
                    <>
                        <h3 className="title">
                            Post Something To The world ...
                        </h3>
                        <textarea
                            ref={postInput}
                            value={postContent}
                            onChange={e => {
                                const val = e.target.value;
                                if (val.length <= maxPostContentLength) {
                                    setPostContent(val);
                                }
                            }}
                            maxLength={maxPostContentLength + 1}
                            placeholder="Enter Your Message"
                            className="composer"
                            
                        ></textarea>
                        <span
                            className={
                                isMaxContentHitted()
                                    ? "text-red-500 font-bold counter"
                                    : "text-white counter"
                            }
                        >
                            {isMaxContentHitted()
                                ? `Max: ${maxPostContentLength}`
                                : `Remain ${
                                      maxPostContentLength - postContent.length
                                  }`}
                        </span>

                        <ImagePicker onSelect={fl => setPostImage(fl)} />

                        <input
                            value={authorName}
                            onChange={e => {
                                const v = e.target.value;
                                if (v.length <= maxAuthorName) {
                                    setAuthorName(v);
                                    e.target.style.borderColor = "white";
                                } else {
                                    e.target.style.borderColor = "red";
                                }
                            }}
                            type="text"
                            className="authorInput w-[60%] p-2 self-start text-[.8rem] m-[1rem] mx-[2rem]"
                            placeholder="Enter Author Name, optional..."
                        />
                        {postContent.length < maxPostContentLength &&
                        authorName.length < maxAuthorName &&
                        !posting ? (
                            <button
                                className={
                                    postContent !== "" && authorName !== ""
                                        ? "postBtn clickable"
                                        : "hidden"
                                }
                                onClick={makePost}
                            >
                                Make Post
                            </button>
                        ) : null}

                        <div
                            className={
                                posting ? "loadingBg" : "loadingBg hidden"
                            }
                        >
                            <Spinner content="Making Post 📬" />
                        </div>
                    </>
                }
                name="composer"
            />
        </currentBarContext.Provider>
    );
};

export default App;