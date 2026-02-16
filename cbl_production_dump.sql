--
-- PostgreSQL database dump
--

\restrict ARQxGO8jsBPzCKAXcCwPMoTjrYZvPzN76QGPMUIGk7fWxzKhjCTvx0FyqMIhbPe

-- Dumped from database version 16.11 (df20cf9)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _system; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _system;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: replit_database_migrations_v1; Type: TABLE; Schema: _system; Owner: -
--

CREATE TABLE _system.replit_database_migrations_v1 (
    id bigint NOT NULL,
    build_id text NOT NULL,
    deployment_id text NOT NULL,
    statement_count bigint NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE; Schema: _system; Owner: -
--

CREATE SEQUENCE _system.replit_database_migrations_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: _system; Owner: -
--

ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNED BY _system.replit_database_migrations_v1.id;


--
-- Name: auction_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auction_teams (
    id integer NOT NULL,
    auction_id integer NOT NULL,
    user_id character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    budget real NOT NULL,
    roster_limit integer,
    ip_limit real,
    pa_limit integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: auction_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auction_teams ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auction_teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auctions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auctions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    created_by_id character varying,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    bid_increment real DEFAULT 0.05 NOT NULL,
    year_factor_1 real DEFAULT 1 NOT NULL,
    year_factor_2 real DEFAULT 1.25 NOT NULL,
    year_factor_3 real DEFAULT 1.33 NOT NULL,
    year_factor_4 real DEFAULT 1.43 NOT NULL,
    year_factor_5 real DEFAULT 1.55 NOT NULL,
    default_budget real DEFAULT 260 NOT NULL,
    enforce_budget boolean DEFAULT true NOT NULL,
    league_id integer,
    allow_auto_bidding boolean DEFAULT true NOT NULL,
    allow_bundled_bids boolean DEFAULT true NOT NULL,
    extend_auction_on_bid boolean DEFAULT false NOT NULL,
    limit_source character varying(20) DEFAULT 'manual'::character varying NOT NULL,
    email_notifications character varying(20) DEFAULT 'bidders'::character varying NOT NULL
);


--
-- Name: auctions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auctions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auctions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auto_bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auto_bids (
    id integer NOT NULL,
    free_agent_id integer NOT NULL,
    user_id character varying NOT NULL,
    max_amount real NOT NULL,
    years integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: auto_bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auto_bids ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auto_bids_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bid_bundle_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_bundle_items (
    id integer NOT NULL,
    bundle_id integer NOT NULL,
    free_agent_id integer NOT NULL,
    priority integer NOT NULL,
    amount real NOT NULL,
    years integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    bid_id integer,
    activated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: bid_bundle_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bid_bundle_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bid_bundle_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bid_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bid_bundles (
    id integer NOT NULL,
    auction_id integer NOT NULL,
    user_id character varying NOT NULL,
    name character varying(100),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    active_item_priority integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: bid_bundles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bid_bundles ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bid_bundles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bids; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bids (
    id integer NOT NULL,
    free_agent_id integer NOT NULL,
    user_id character varying NOT NULL,
    amount real NOT NULL,
    years integer NOT NULL,
    total_value real NOT NULL,
    is_auto_bid boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_imported_initial boolean DEFAULT false NOT NULL
);


--
-- Name: bids_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bids ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bids_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_opt_outs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_opt_outs (
    id integer NOT NULL,
    auction_id integer NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: email_opt_outs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_opt_outs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.email_opt_outs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: free_agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.free_agents (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    team character varying(100),
    auction_end_time timestamp without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    winner_id character varying,
    winning_bid_id integer,
    created_at timestamp without time zone DEFAULT now(),
    minimum_bid real DEFAULT 1 NOT NULL,
    minimum_years integer DEFAULT 1 NOT NULL,
    player_type character varying(20) DEFAULT 'hitter'::character varying NOT NULL,
    avg real,
    hr integer,
    rbi integer,
    runs integer,
    sb integer,
    ops real,
    wins integer,
    losses integer,
    era real,
    whip real,
    strikeouts integer,
    ip real,
    pa integer,
    auction_id integer,
    auction_start_time timestamp without time zone,
    result_emailed_at timestamp without time zone
);


--
-- Name: free_agents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.free_agents ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.free_agents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: league_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_members (
    id integer NOT NULL,
    league_id integer NOT NULL,
    user_id character varying NOT NULL,
    role character varying(20) DEFAULT 'owner'::character varying NOT NULL,
    team_name character varying,
    team_abbreviation character varying(3),
    is_archived boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: league_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.league_members ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.league_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: league_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_settings (
    id integer DEFAULT 1 NOT NULL,
    year_factor_1 real DEFAULT 1 NOT NULL,
    year_factor_2 real DEFAULT 1.25 NOT NULL,
    year_factor_3 real DEFAULT 1.33 NOT NULL,
    year_factor_4 real DEFAULT 1.43 NOT NULL,
    year_factor_5 real DEFAULT 1.55 NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    default_budget real DEFAULT 260 NOT NULL,
    enforce_budget boolean DEFAULT true NOT NULL
);


--
-- Name: leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leagues (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    timezone character varying(50) DEFAULT 'America/New_York'::character varying NOT NULL,
    created_by_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    budget_cap real,
    ip_cap real,
    pa_cap integer
);


--
-- Name: leagues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.leagues ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.leagues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    user_id character varying NOT NULL,
    token character varying NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.password_reset_tokens ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.password_reset_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roster_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roster_players (
    id integer NOT NULL,
    league_id integer NOT NULL,
    user_id character varying NOT NULL,
    player_name character varying(255) NOT NULL,
    player_type character varying(10) NOT NULL,
    ip real,
    pa integer,
    salary real DEFAULT 0 NOT NULL,
    contract_years integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: roster_players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.roster_players ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.roster_players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying NOT NULL,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    is_commissioner boolean DEFAULT false NOT NULL,
    team_name character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    password_hash character varying,
    must_reset_password boolean DEFAULT false NOT NULL,
    is_super_admin boolean DEFAULT false NOT NULL,
    is_archived boolean DEFAULT false NOT NULL,
    team_abbreviation character varying(3)
);


--
-- Name: replit_database_migrations_v1 id; Type: DEFAULT; Schema: _system; Owner: -
--

ALTER TABLE ONLY _system.replit_database_migrations_v1 ALTER COLUMN id SET DEFAULT nextval('_system.replit_database_migrations_v1_id_seq'::regclass);


--
-- Data for Name: replit_database_migrations_v1; Type: TABLE DATA; Schema: _system; Owner: -
--

COPY _system.replit_database_migrations_v1 (id, build_id, deployment_id, statement_count, applied_at) FROM stdin;
1	42225078-895c-4b9e-a5d5-f5bdb852122f	432920e7-25bb-4a83-91ed-b7305183aeba	7	2025-12-11 06:32:44.584551+00
2	1562a99f-a2b6-4e50-9c89-699642dfdc3f	432920e7-25bb-4a83-91ed-b7305183aeba	9	2025-12-25 00:38:54.763631+00
3	abee7303-2d00-415b-8c3b-05aa1b07758d	432920e7-25bb-4a83-91ed-b7305183aeba	1	2025-12-28 03:45:52.751093+00
4	db4f9388-0405-429d-ac46-4a41505e08e0	432920e7-25bb-4a83-91ed-b7305183aeba	12	2025-12-30 23:11:56.727714+00
5	096e9063-c072-4ea0-be8b-8ff3f18b9412	432920e7-25bb-4a83-91ed-b7305183aeba	2	2026-01-11 20:47:25.839338+00
6	a8b0639f-fed7-4902-b84f-850a34a4a7a1	432920e7-25bb-4a83-91ed-b7305183aeba	1	2026-01-15 03:23:44.638807+00
\.


--
-- Data for Name: auction_teams; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auction_teams (id, auction_id, user_id, is_active, budget, roster_limit, ip_limit, pa_limit, created_at, updated_at) FROM stdin;
68	4	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	t	4.1129744e+07	6	749	3312	2025-12-25 21:04:19.138973	2025-12-25 21:04:19.138973
69	4	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	t	4.8226936e+07	8	780	1768	2025-12-25 21:04:19.200159	2025-12-25 21:04:19.200159
70	4	02538c92-2a46-43e6-8351-33297d6de099	t	3.249266e+07	2	694	1864	2025-12-25 21:04:19.261705	2025-12-25 21:04:19.261705
71	4	cec18033-5816-4170-97d9-81dcd4c2670b	t	7.006532e+06	8	634	1113	2025-12-25 21:04:19.3231	2025-12-25 21:04:19.3231
72	4	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	t	3.5022732e+07	8	977	1776	2025-12-25 21:04:19.384109	2025-12-25 21:04:19.384109
73	4	f335b9c3-7d63-44f3-9540-13b1d461ca13	t	6.152824e+06	11	956	2650	2025-12-25 21:04:19.444928	2025-12-25 21:04:19.444928
74	4	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	t	2.0149024e+07	3	203	978	2025-12-25 21:04:19.505739	2025-12-25 21:04:19.505739
75	4	e08f4fb4-f7df-4224-9a81-21c0f93cf810	t	3.4943284e+07	11	916	2341	2025-12-25 21:04:19.566393	2025-12-25 21:04:19.566393
76	4	e2831203-b5bb-4911-9a98-485fe4c6e3b5	t	3.3489738e+07	13	1049	1940	2025-12-25 21:04:19.627243	2025-12-25 21:04:19.627243
77	4	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	t	8.205665e+07	11	1036	2123	2025-12-25 21:04:19.688173	2025-12-25 21:04:19.688173
78	4	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	t	2.2954054e+07	12	934	2443	2025-12-25 21:04:19.749126	2025-12-25 21:04:19.749126
79	4	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	t	3.6016476e+07	3	453	3697	2025-12-25 21:04:19.809945	2025-12-25 21:04:19.809945
80	4	c532b6f7-bdfb-4505-b43f-f653770c03af	t	1.3327558e+07	4	471	423	2025-12-25 21:04:19.870953	2025-12-25 21:04:19.870953
81	4	5084741d-1673-42b3-a8e3-3d422874e814	t	2.162244e+07	5	698	1722	2025-12-25 21:04:19.931551	2025-12-25 21:04:19.931551
82	4	4f229366-dbe3-4361-84cb-115cab42685f	t	2.889538e+07	9	789	2636	2025-12-25 21:04:19.992607	2025-12-25 21:04:19.992607
83	4	51f792dc-04f3-467f-a604-631165c75b38	t	4.4584044e+07	10	781	3146	2025-12-25 21:04:20.053635	2025-12-25 21:04:20.053635
84	4	388f55c3-52e1-499f-8a56-948636a8c205	t	3.0739038e+07	6	509	1459	2025-12-25 21:04:20.114521	2025-12-25 21:04:20.114521
85	4	889cd08b-6e70-4f4c-847f-363dbbe2c110	t	8.319704e+07	18	1445	2192	2025-12-25 21:04:20.175452	2025-12-25 21:04:20.175452
86	4	cc78d40c-9179-4616-9834-9aa9c69963fa	t	2.5250128e+07	10	588	2540	2025-12-25 21:04:20.236541	2025-12-25 21:04:20.236541
87	4	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	t	6.524225e+06	5	631	1588	2025-12-25 21:04:20.297469	2025-12-25 21:04:20.297469
88	4	0477609b-080d-4cd2-b891-117e615bdf47	t	2.9253114e+07	1	316	2615	2025-12-25 21:04:20.358215	2025-12-25 21:04:20.358215
89	4	7779ed21-af49-4fbd-8127-c5a869384569	t	6.546024e+06	7	423	517	2025-12-25 21:04:20.419017	2025-12-25 21:04:20.419017
90	4	d8be0952-18cc-4082-8a6c-5de14ea569ce	t	1.820687e+07	16	1046	3636	2025-12-25 21:04:20.480066	2025-12-25 21:04:20.480066
91	4	17faf686-27d1-4e30-a11c-4e7ec21ca685	t	6.5149744e+07	8	1280	1629	2025-12-25 21:04:20.540743	2025-12-25 21:04:20.540743
92	4	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	t	6.883465e+07	14	1022	3289	2025-12-25 21:04:20.602024	2025-12-25 21:04:20.602024
94	4	5d77ac22-c768-4d3b-99d8-73c250a3e859	t	5.2190412e+07	14	998	4221	2025-12-25 21:04:20.72374	2025-12-25 21:04:20.72374
95	4	6f591686-4009-4693-a2c7-d3eb1b36073f	t	3.110465e+07	1	851	2335	2025-12-25 21:04:20.78478	2025-12-25 21:04:20.78478
96	4	c4815f14-1981-43aa-b972-5f7a43ed0f13	t	7.403661e+07	10	864	2266	2025-12-25 21:04:20.845613	2025-12-25 21:04:20.845613
93	4	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	t	1.765192e+06	11	651	2137	2025-12-25 21:04:20.663092	2026-01-11 16:19:33.642
67	4	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	t	2.7307856e+07	11	932	2500	2025-12-25 21:04:19.07	2026-01-11 19:43:13.455
250	10	02538c92-2a46-43e6-8351-33297d6de099	t	3.329266e+07	5	495	1364	2026-01-11 23:29:16.138933	2026-01-22 19:26:25.746
247	10	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	t	2.6757856e+07	11	680	1632	2026-01-11 23:29:15.942721	2026-01-22 19:26:02.858
256	10	e2831203-b5bb-4911-9a98-485fe4c6e3b5	t	3.8726816e+07	15	849	1440	2026-01-11 23:29:16.518791	2026-01-22 19:27:20.529
248	10	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	t	4.1099744e+07	8	549	2863	2026-01-11 23:29:16.00634	2026-01-22 19:50:13.755
267	10	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	t	4.924225e+06	6	431	1088	2026-01-11 23:29:17.213807	2026-01-22 19:28:40.43
251	10	cec18033-5816-4170-97d9-81dcd4c2670b	t	5.866532e+06	7	333	541	2026-01-11 23:29:16.202499	2026-01-22 19:26:32.099
260	10	c532b6f7-bdfb-4505-b43f-f653770c03af	t	1.3327558e+07	5	271	\N	2026-01-11 23:29:16.77095	2026-01-22 19:27:55.619
254	10	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	t	2.0149024e+07	2	\N	478	2026-01-11 23:29:16.392451	2026-01-22 19:26:56.406
264	10	388f55c3-52e1-499f-8a56-948636a8c205	t	3.0409036e+07	6	309	959	2026-01-11 23:29:17.024369	2026-01-22 19:28:20.502
275	10	6f591686-4009-4693-a2c7-d3eb1b36073f	t	2.7681534e+07	7	633	1608	2026-01-11 23:29:17.717503	2026-01-26 20:38:33.395
261	10	5084741d-1673-42b3-a8e3-3d422874e814	t	2.162244e+07	5	498	1222	2026-01-11 23:29:16.83414	2026-01-22 19:28:01.232
257	10	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	t	8.012665e+07	12	836	1623	2026-01-11 23:29:16.581547	2026-01-22 19:27:27.179
271	10	17faf686-27d1-4e30-a11c-4e7ec21ca685	t	6.4599744e+07	11	1080	1129	2026-01-11 23:29:17.464672	2026-01-25 00:09:57.002
270	10	d8be0952-18cc-4082-8a6c-5de14ea569ce	t	1.5406871e+07	17	846	3136	2026-01-11 23:29:17.401851	2026-01-22 19:29:06.183
265	10	889cd08b-6e70-4f4c-847f-363dbbe2c110	t	8.264704e+07	17	1245	1692	2026-01-11 23:29:17.087054	2026-01-22 19:28:27.129
262	10	4f229366-dbe3-4361-84cb-115cab42685f	t	2.749538e+07	10	640	2367	2026-01-11 23:29:16.897317	2026-01-26 15:43:47.897
255	10	e08f4fb4-f7df-4224-9a81-21c0f93cf810	t	3.3683284e+07	11	716	1841	2026-01-11 23:29:16.45559	2026-01-22 19:27:06.644
272	10	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	t	6.833465e+07	14	757	2789	2026-01-11 23:29:17.527569	2026-01-22 19:28:54.573
266	10	cc78d40c-9179-4616-9834-9aa9c69963fa	t	2.4700128e+07	9	388	2040	2026-01-11 23:29:17.15101	2026-01-22 19:28:32.638
273	10	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	t	2.911541e+06	8	421	1730	2026-01-11 23:29:17.591528	2026-01-22 19:29:21.572
253	10	f335b9c3-7d63-44f3-9540-13b1d461ca13	t	6.082824e+06	11	756	2150	2026-01-11 23:29:16.330376	2026-01-22 19:26:39.502
249	10	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	t	4.7676936e+07	6	580	1119	2026-01-11 23:29:16.075434	2026-01-22 19:26:17.877
268	10	0477609b-080d-4cd2-b891-117e615bdf47	t	2.8633116e+07	4	179	2146	2026-01-11 23:29:17.276097	2026-01-22 20:10:58.373
258	10	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	t	2.2954056e+07	12	734	1943	2026-01-11 23:29:16.644695	2026-01-22 19:27:35.684
263	10	51f792dc-04f3-467f-a604-631165c75b38	t	6.4376192e+07	13	581	2646	2026-01-11 23:29:16.960817	2026-01-22 19:28:07.416
259	10	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	t	5.7786472e+07	6	448	3197	2026-01-11 23:29:16.707526	2026-01-22 19:27:48.923
252	10	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	t	3.4572732e+07	8	777	1276	2026-01-11 23:29:16.266061	2026-01-22 19:26:46.68
269	10	7779ed21-af49-4fbd-8127-c5a869384569	t	2.682214e+07	4	250	17	2026-01-11 23:29:17.338768	2026-01-24 20:08:13.829
276	10	c4815f14-1981-43aa-b972-5f7a43ed0f13	t	7.348661e+07	9	664	1766	2026-01-11 23:29:17.780724	2026-01-22 19:27:13.096
274	10	5d77ac22-c768-4d3b-99d8-73c250a3e859	t	5.1640412e+07	13	798	3721	2026-01-11 23:29:17.654825	2026-01-22 19:29:27.959
\.


--
-- Data for Name: auctions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auctions (id, name, status, created_by_id, is_deleted, created_at, updated_at, bid_increment, year_factor_1, year_factor_2, year_factor_3, year_factor_4, year_factor_5, default_budget, enforce_budget, league_id, allow_auto_bidding, allow_bundled_bids, extend_auction_on_bid, limit_source, email_notifications) FROM stdin;
4	2026 Test	draft	388f55c3-52e1-499f-8a56-948636a8c205	f	2025-12-25 21:03:49.654046	2026-01-11 21:12:34.596	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	league
5	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	t	2026-01-11 17:15:06.272737	2026-01-11 21:27:43.584	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	none
6	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	t	2026-01-11 22:36:49.465517	2026-01-11 22:39:19.896	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	bidders
7	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	t	2026-01-11 22:39:30.155059	2026-01-11 22:50:53.41	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	bidders
8	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	t	2026-01-11 22:51:05.403547	2026-01-11 23:22:11.93	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	bidders
9	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	t	2026-01-11 23:22:23.416176	2026-01-11 23:27:16.493	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	bidders
10	2026 Free Agency	active	388f55c3-52e1-499f-8a56-948636a8c205	f	2026-01-11 23:29:03.838586	2026-01-13 13:47:17.051	0.05	1	1.25	1.33	1.43	1.55	260	t	2	t	t	f	manual	league
\.


--
-- Data for Name: auto_bids; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auto_bids (id, free_agent_id, user_id, max_amount, years, is_active, created_at, updated_at) FROM stdin;
18	1460	388f55c3-52e1-499f-8a56-948636a8c205	6e+06	3	f	2025-12-25 21:08:38.880882	2025-12-28 01:00:50.41
20	1460	7779ed21-af49-4fbd-8127-c5a869384569	6.546024e+06	2	f	2025-12-27 20:35:31.301776	2025-12-28 01:00:50.41
19	1469	388f55c3-52e1-499f-8a56-948636a8c205	1e+06	1	f	2025-12-25 21:09:00.632631	2025-12-28 01:10:53.21
21	1531	388f55c3-52e1-499f-8a56-948636a8c205	1.2e+06	1	f	2025-12-29 01:04:18.390019	2025-12-30 01:09:30.469
22	1763	4f229366-dbe3-4361-84cb-115cab42685f	1.5e+06	1	f	2026-01-04 18:24:43.475548	2026-01-05 01:14:37.74
57	4387	388f55c3-52e1-499f-8a56-948636a8c205	1.75e+06	1	f	2026-01-13 17:09:09.145106	2026-01-15 02:23:15.915
25	1931	6f591686-4009-4693-a2c7-d3eb1b36073f	2e+06	3	f	2026-01-09 14:46:18.945548	2026-01-10 01:03:32.847
27	1933	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.3e+06	1	f	2026-01-09 22:14:27.363623	2026-01-10 01:03:33.096
28	1933	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3e+06	3	f	2026-01-10 00:56:30.516834	2026-01-10 01:03:33.096
24	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	600000	4	f	2026-01-09 14:02:56.211117	2026-01-10 01:03:33.214
26	1934	0477609b-080d-4cd2-b891-117e615bdf47	662162	4	f	2026-01-09 14:47:33.491744	2026-01-10 01:03:33.214
29	1951	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	7.5e+06	5	f	2026-01-10 00:57:58.208174	2026-01-10 01:23:32.939
23	1962	cc78d40c-9179-4616-9834-9aa9c69963fa	7e+06	3	f	2026-01-09 13:07:22.470144	2026-01-10 01:33:45.339
64	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	775000	2	f	2026-01-13 18:48:56.549767	2026-01-15 02:23:15.915
38	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.859999e+06	3	f	2026-01-12 05:04:40.822845	2026-01-24 02:21:26.595
63	4375	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	665000	2	f	2026-01-13 18:42:56.929011	2026-01-15 02:13:37.015
76	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.509876e+06	2	f	2026-01-14 14:58:51.981457	2026-01-16 02:31:01.799
90	4365	7779ed21-af49-4fbd-8127-c5a869384569	2.2948684e+07	2	f	2026-01-15 01:59:43.661652	2026-01-15 02:03:17.092
71	4371	cc78d40c-9179-4616-9834-9aa9c69963fa	1.7e+06	2	f	2026-01-14 03:04:55.941564	2026-01-15 02:03:14.692
74	4393	cc78d40c-9179-4616-9834-9aa9c69963fa	631575	3	f	2026-01-14 13:26:33.274718	2026-01-15 02:33:41.964
39	4712	17faf686-27d1-4e30-a11c-4e7ec21ca685	1	2	f	2026-01-12 05:05:43.719022	2026-01-25 02:01:09.307
35	4458	17faf686-27d1-4e30-a11c-4e7ec21ca685	1	2	f	2026-01-12 04:58:32.071047	2026-01-17 02:21:02.439
47	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	6e+06	3	f	2026-01-12 21:41:06.209124	2026-01-19 02:00:43.688
65	4604	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	2.333333e+06	1	f	2026-01-13 19:04:32.224218	2026-01-21 02:30:42.116
44	4379	02538c92-2a46-43e6-8351-33297d6de099	8.879935e+06	3	f	2026-01-12 13:59:40.179516	2026-01-15 02:13:37.684
48	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.95e+06	4	f	2026-01-12 21:43:52.571609	2026-01-26 02:21:03.801
85	4402	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	750000	1	f	2026-01-14 22:17:50.849869	2026-01-16 02:00:39.325
86	4429	51f792dc-04f3-467f-a604-631165c75b38	3e+06	1	f	2026-01-15 01:34:08.475975	2026-01-16 02:31:01.799
52	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	9.9e+06	3	f	2026-01-12 22:00:53.701958	2026-01-16 02:10:41.667
70	4364	51f792dc-04f3-467f-a604-631165c75b38	400000	3	f	2026-01-14 01:49:45.615488	2026-01-15 02:01:04.649
62	4366	388f55c3-52e1-499f-8a56-948636a8c205	6.5e+06	2	f	2026-01-13 17:57:52.414949	2026-01-15 02:01:10.182
33	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.900581e+06	3	f	2026-01-12 04:49:31.623396	2026-01-15 02:03:14.692
45	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	750000	1	f	2026-01-12 18:33:55.339778	2026-01-15 02:13:37.318
56	4370	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2e+07	1	f	2026-01-13 16:11:06.882395	2026-01-15 02:03:05.508
30	4370	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.6555555e+07	2	f	2026-01-12 04:26:15.791428	2026-01-15 02:03:05.508
79	4374	4f229366-dbe3-4361-84cb-115cab42685f	3e+06	1	f	2026-01-14 18:13:36.909144	2026-01-15 02:13:37.318
81	4376	cc78d40c-9179-4616-9834-9aa9c69963fa	600600	4	f	2026-01-14 20:29:54.523038	2026-01-15 02:13:37.438
55	4379	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.1e+07	2	f	2026-01-13 02:29:46.604214	2026-01-15 02:13:37.684
78	4390	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.5e+07	1	f	2026-01-14 15:17:59.29598	2026-01-15 02:33:41.743
68	4390	51f792dc-04f3-467f-a604-631165c75b38	9.8e+06	1	f	2026-01-14 01:43:50.897453	2026-01-15 02:33:41.743
67	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.5e+06	2	f	2026-01-14 00:48:26.338999	2026-01-15 02:33:41.964
89	4375	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.5e+06	1	f	2026-01-15 01:56:14.112386	2026-01-15 02:13:37.015
31	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.8599992e+07	4	f	2026-01-12 04:29:21.579546	2026-01-15 02:13:37.684
54	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3e+06	1	f	2026-01-12 23:18:16.121471	2026-01-18 02:31:13.95
73	4394	388f55c3-52e1-499f-8a56-948636a8c205	8e+06	5	f	2026-01-14 06:33:28.932255	2026-01-15 02:33:39.276
75	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	4.5e+06	5	f	2026-01-14 14:45:11.070164	2026-01-15 02:33:39.276
82	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	5e+06	1	f	2026-01-14 21:20:47.726104	2026-01-17 02:30:50.439
84	4408	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1e+06	1	f	2026-01-14 22:05:50.133233	2026-01-16 02:10:41.891
77	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	4e+06	3	f	2026-01-14 15:04:47.460955	2026-01-17 23:00:34.267
49	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.251e+06	1	f	2026-01-12 21:46:40.737901	2026-01-23 02:00:48.899
69	4400	51f792dc-04f3-467f-a604-631165c75b38	6e+06	2	f	2026-01-14 01:44:27.145588	2026-01-16 02:00:40.049
72	4400	388f55c3-52e1-499f-8a56-948636a8c205	5.9e+06	2	f	2026-01-14 05:12:15.528223	2026-01-16 02:00:40.049
34	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.001999e+06	2	f	2026-01-12 04:51:26.891644	2026-01-16 02:20:49.573
53	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3e+06	2	f	2026-01-12 22:34:35.795228	2026-01-16 02:10:41.891
80	4425	6f591686-4009-4693-a2c7-d3eb1b36073f	3.5e+06	1	f	2026-01-14 18:35:20.851133	2026-01-16 02:20:49.686
87	4425	51f792dc-04f3-467f-a604-631165c75b38	5.2e+06	1	f	2026-01-15 01:34:44.283796	2026-01-16 02:20:49.686
58	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	4.5e+06	2	f	2026-01-13 17:31:11.022244	2026-01-16 02:30:49.957
83	4427	6f591686-4009-4693-a2c7-d3eb1b36073f	2.85e+06	2	f	2026-01-14 21:54:03.76142	2026-01-16 02:30:49.957
66	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.7e+06	3	f	2026-01-13 22:52:42.984041	2026-01-17 02:31:02.439
59	4496	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.75e+06	1	f	2026-01-13 17:34:10.463062	2026-01-18 02:31:15.85
36	4484	17faf686-27d1-4e30-a11c-4e7ec21ca685	1	2	f	2026-01-12 04:59:33.134691	2026-01-18 02:11:15.55
60	4585	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	750000	1	f	2026-01-13 17:40:21.279682	2026-01-21 02:10:33.578
41	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	8.400991e+06	3	f	2026-01-12 05:09:02.894918	2026-01-25 02:21:12.375
40	4709	17faf686-27d1-4e30-a11c-4e7ec21ca685	780999	2	f	2026-01-12 05:06:56.464631	2026-01-25 02:01:10.694
61	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.2e+07	5	f	2026-01-13 17:41:17.430943	2026-01-21 02:20:35.803
37	4577	17faf686-27d1-4e30-a11c-4e7ec21ca685	8.400991e+06	3	f	2026-01-12 05:01:58.273377	2026-01-21 02:00:36.112
51	4577	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.4751e+07	4	f	2026-01-12 21:54:52.774694	2026-01-21 02:00:36.112
43	4590	17faf686-27d1-4e30-a11c-4e7ec21ca685	1	5	f	2026-01-12 05:22:04.57295	2026-01-21 02:20:35.803
46	4789	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1	1	f	2026-01-12 21:37:24.958121	2026-01-27 02:11:04.251
42	4719	17faf686-27d1-4e30-a11c-4e7ec21ca685	1	1	f	2026-01-12 05:11:20.054438	2026-01-25 02:11:11.052
32	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.3435999e+07	4	f	2026-01-12 04:46:29.229004	2026-01-28 02:23:15.992
88	4364	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.25e+06	1	f	2026-01-15 01:55:15.17705	2026-01-15 02:01:04.649
50	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.501e+06	2	f	2026-01-12 21:48:29.221669	2026-01-15 02:13:37.318
107	4435	51f792dc-04f3-467f-a604-631165c75b38	1.2e+06	5	f	2026-01-16 03:09:10.388033	2026-01-17 02:00:35.439
95	4394	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.6e+07	3	f	2026-01-15 02:29:03.764148	2026-01-15 02:33:39.276
122	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.111111e+06	4	f	2026-01-16 22:38:41.785811	2026-01-17 02:00:35.439
120	4436	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.5e+06	2	f	2026-01-16 22:36:45.315263	2026-01-17 02:00:35.986
145	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1e+06	3	f	2026-01-17 21:25:31.588078	2026-01-18 02:11:12.35
106	4437	51f792dc-04f3-467f-a604-631165c75b38	1.7e+07	2	f	2026-01-16 03:08:35.307576	2026-01-17 02:00:36.555
113	4437	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.934606e+07	2	f	2026-01-16 19:43:17.260068	2026-01-17 02:00:36.555
91	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	750000	1	f	2026-01-15 02:02:31.149007	2026-01-16 02:00:39.211
103	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	915975	1	f	2026-01-16 01:39:54.109276	2026-01-16 02:00:39.211
98	4412	cc78d40c-9179-4616-9834-9aa9c69963fa	1.1025e+07	3	f	2026-01-15 15:28:04.377341	2026-01-16 02:10:41.667
101	4410	0477609b-080d-4cd2-b891-117e615bdf47	2e+06	3	f	2026-01-15 23:48:12.029845	2026-01-16 02:10:41.779
96	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.6e+06	2	f	2026-01-15 04:21:19.384754	2026-01-16 02:10:41.891
99	4424	4f229366-dbe3-4361-84cb-115cab42685f	1e+06	1	f	2026-01-15 18:36:52.778986	2026-01-16 02:20:49.573
94	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.74473e+06	2	f	2026-01-15 02:24:02.067717	2026-01-16 02:30:49.957
105	4427	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	7.5e+06	2	f	2026-01-16 02:29:04.627749	2026-01-16 02:30:49.957
102	4431	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.418103e+06	1	f	2026-01-16 00:18:41.767131	2026-01-16 02:31:03.099
155	4790	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.441144e+06	2	f	2026-01-18 05:32:07.917766	2026-01-27 02:11:04.369
139	4477	4f229366-dbe3-4361-84cb-115cab42685f	1.5e+06	3	f	2026-01-17 05:30:24.128607	2026-01-18 02:11:12.35
133	4484	51f792dc-04f3-467f-a604-631165c75b38	3e+06	1	f	2026-01-17 03:20:38.730865	2026-01-18 02:11:15.55
140	4484	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.952441e+06	2	f	2026-01-17 15:27:51.540173	2026-01-18 02:11:15.55
108	4447	51f792dc-04f3-467f-a604-631165c75b38	5.8e+06	1	f	2026-01-16 03:12:21.949893	2026-01-17 02:10:37.365
151	4522	17faf686-27d1-4e30-a11c-4e7ec21ca685	400999	2	f	2026-01-18 04:19:49.898313	2026-01-19 02:20:36.979
110	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	1e+07	3	f	2026-01-16 15:19:43.554972	2026-01-17 02:10:37.365
112	4455	5d77ac22-c768-4d3b-99d8-73c250a3e859	600000	1	f	2026-01-16 17:19:12.034861	2026-01-17 02:20:39.76
114	4453	889cd08b-6e70-4f4c-847f-363dbbe2c110	400000	1	f	2026-01-16 19:45:08.42787	2026-01-17 02:21:01.338
130	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.24e+06	1	f	2026-01-17 01:37:24.212075	2026-01-17 02:30:50.439
115	4462	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.736439e+06	2	f	2026-01-16 19:45:37.411033	2026-01-17 02:31:02.439
119	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.5e+06	4	f	2026-01-16 22:34:36.390505	2026-01-17 02:31:02.439
131	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.693792e+06	3	f	2026-01-17 02:25:49.875514	2026-01-17 02:31:02.439
157	4509	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.751e+06	3	f	2026-01-18 14:17:55.880702	2026-01-19 02:00:43.801
92	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.5e+06	1	f	2026-01-15 02:09:13.108096	2026-01-18 02:31:28.85
118	4570	388f55c3-52e1-499f-8a56-948636a8c205	1e+07	4	f	2026-01-16 21:48:34.620529	2026-01-20 02:30:25.564
121	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	6e+06	1	f	2026-01-16 22:36:58.82956	2026-01-18 02:01:23.75
109	4499	51f792dc-04f3-467f-a604-631165c75b38	4e+06	1	f	2026-01-16 03:17:07.685837	2026-01-18 02:31:28.85
97	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	4.5e+06	3	f	2026-01-15 15:17:21.833044	2026-01-17 23:00:34.267
132	4844	51f792dc-04f3-467f-a604-631165c75b38	8e+06	3	f	2026-01-17 03:19:30.086541	2026-01-17 23:00:34.267
124	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	6.5e+06	3	f	2026-01-16 22:47:34.505989	2026-01-18 02:31:28.85
116	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.144441e+06	3	f	2026-01-16 19:47:35.573661	2026-01-18 02:31:28.85
123	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.575e+06	2	f	2026-01-16 22:44:34.638063	2026-01-18 02:01:23.75
136	4475	51f792dc-04f3-467f-a604-631165c75b38	6.3e+06	1	f	2026-01-17 03:27:17.04739	2026-01-18 02:01:23.75
129	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.999999e+06	1	f	2026-01-17 00:29:53.355571	2026-01-18 02:01:23.75
138	4475	4f229366-dbe3-4361-84cb-115cab42685f	5e+06	1	f	2026-01-17 05:27:39.668201	2026-01-18 02:01:23.75
127	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.525e+06	2	f	2026-01-16 23:17:02.889054	2026-01-18 02:31:13.95
111	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.25e+06	2	f	2026-01-16 15:38:55.148376	2026-01-18 02:31:16.85
117	4497	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.940838e+06	1	f	2026-01-16 19:48:18.105158	2026-01-18 02:31:16.85
125	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.5e+06	3	f	2026-01-16 22:48:13.114458	2026-01-18 02:31:16.85
146	4500	51f792dc-04f3-467f-a604-631165c75b38	1.3928991e+07	1	f	2026-01-18 01:54:41.006916	2026-01-18 02:31:29.687
141	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.144144e+06	3	f	2026-01-17 15:43:43.479815	2026-01-21 02:30:42.116
128	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.5e+06	3	f	2026-01-16 23:59:40.507309	2026-01-19 02:10:35.903
150	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	9e+06	1	f	2026-01-18 03:40:11.206264	2026-01-19 02:20:38.751
153	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.899999e+06	3	f	2026-01-18 04:29:40.89747	2026-01-20 02:20:28.501
152	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.400999e+06	2	f	2026-01-18 04:27:26.960605	2026-01-20 02:00:20.439
134	4507	51f792dc-04f3-467f-a604-631165c75b38	2e+06	1	f	2026-01-17 03:22:07.820022	2026-01-19 02:00:43.688
126	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.5e+06	4	f	2026-01-16 22:50:12.458476	2026-01-19 02:10:35.903
135	4520	51f792dc-04f3-467f-a604-631165c75b38	1.1e+07	1	f	2026-01-17 03:23:23.692409	2026-01-19 02:20:38.751
137	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	6e+06	2	f	2026-01-17 03:57:22.737924	2026-01-20 02:10:21.194
159	4568	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.104731e+06	1	f	2026-01-18 15:02:25.452361	2026-01-20 02:30:25.675
158	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	5.95e+06	1	f	2026-01-18 14:30:47.483296	2026-01-20 02:00:20.655
143	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.674144e+06	2	f	2026-01-17 16:26:17.882538	2026-01-20 02:10:21.194
104	4692	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	f	2026-01-16 02:10:45.05024	2026-01-24 02:21:26.595
156	4587	5d77ac22-c768-4d3b-99d8-73c250a3e859	8e+06	2	f	2026-01-18 05:49:12.402515	2026-01-21 02:10:33.124
147	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.6e+07	5	f	2026-01-18 02:29:20.676201	2026-01-21 02:20:35.803
148	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	6e+06	3	f	2026-01-18 02:29:45.013058	2026-01-21 02:30:42.116
160	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.5e+06	2	f	2026-01-18 16:39:49.360093	2026-01-22 02:00:47.629
100	4802	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1	2	f	2026-01-15 23:42:57.5381	2026-01-27 02:31:04.608
93	4621	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	6e+06	3	f	2026-01-15 02:15:32.214385	2026-01-22 02:10:49.748
149	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.1111111e+07	3	f	2026-01-18 02:30:09.390102	2026-01-22 02:10:49.748
154	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.4444144e+07	2	f	2026-01-18 05:30:01.80825	2026-01-27 02:01:26.979
228	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.144441e+06	1	f	2026-01-22 06:05:32.857769	2026-01-25 02:33:28.401
144	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.744144e+06	2	f	2026-01-17 16:32:21.482293	2026-01-19 02:00:43.688
163	4536	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.144441e+06	2	f	2026-01-18 18:23:54.691705	2026-01-19 02:30:55.3
166	4536	51f792dc-04f3-467f-a604-631165c75b38	9e+06	1	f	2026-01-19 02:27:49.418605	2026-01-19 02:30:55.3
232	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	2.5e+06	2	f	2026-01-22 13:15:54.538816	2026-01-23 02:00:48.899
173	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.25e+06	1	f	2026-01-19 04:31:49.646039	2026-01-19 21:00:29.664
177	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	2.566548e+06	1	f	2026-01-19 19:53:44.773462	2026-01-19 21:00:29.664
204	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	600000	2	f	2026-01-21 01:29:31.891303	2026-01-24 02:01:18.913
167	4539	51f792dc-04f3-467f-a604-631165c75b38	2e+06	1	f	2026-01-19 02:32:42.231487	2026-01-20 02:00:20.439
168	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.5e+06	1	f	2026-01-19 03:01:26.27922	2026-01-20 02:00:20.439
179	4539	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.705514e+06	2	f	2026-01-20 00:07:22.413791	2026-01-20 02:00:20.439
176	4540	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	700000	2	f	2026-01-19 18:23:45.930678	2026-01-20 02:00:20.547
175	4544	889cd08b-6e70-4f4c-847f-363dbbe2c110	444000	1	f	2026-01-19 16:07:40.324653	2026-01-20 02:00:20.939
208	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.5e+06	2	f	2026-01-21 03:49:24.815121	2026-01-22 02:00:47.629
174	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	3e+06	3	f	2026-01-19 13:12:28.492105	2026-01-20 02:20:28.501
169	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	7.5e+06	3	f	2026-01-19 03:14:19.645656	2026-01-20 02:30:25.564
181	4568	5d77ac22-c768-4d3b-99d8-73c250a3e859	3e+06	1	f	2026-01-20 00:45:36.236087	2026-01-20 02:30:25.675
219	4656	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.25e+06	1	f	2026-01-21 20:01:00.401309	2026-01-23 02:10:46.657
162	4577	02538c92-2a46-43e6-8351-33297d6de099	8.75e+06	3	f	2026-01-18 18:13:42.443462	2026-01-21 02:00:36.112
170	4579	f335b9c3-7d63-44f3-9540-13b1d461ca13	600000	1	f	2026-01-19 03:41:53.614066	2026-01-21 02:00:36.229
217	4614	51f792dc-04f3-467f-a604-631165c75b38	3.7e+06	2	f	2026-01-21 16:25:37.912533	2026-01-22 02:00:47.629
180	4586	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.5e+06	1	f	2026-01-20 00:25:13.81846	2026-01-21 02:10:32.05
182	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.456785e+06	2	f	2026-01-20 01:37:21.668356	2026-01-21 02:10:32.05
193	4586	51f792dc-04f3-467f-a604-631165c75b38	3.5e+06	1	f	2026-01-20 22:11:55.039061	2026-01-21 02:10:32.05
165	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	1e+07	2	f	2026-01-18 22:43:13.617575	2026-01-21 02:30:41.689
194	4603	51f792dc-04f3-467f-a604-631165c75b38	1.45e+07	1	f	2026-01-20 22:13:42.658858	2026-01-21 02:30:41.689
183	4592	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	640000	1	f	2026-01-20 01:58:36.561555	2026-01-21 02:20:33.263
191	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.476859e+06	2	f	2026-01-20 17:35:32.743065	2026-01-21 02:20:33.263
185	4592	51f792dc-04f3-467f-a604-631165c75b38	4e+06	1	f	2026-01-20 02:46:07.372473	2026-01-21 02:20:33.263
161	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	7e+06	5	f	2026-01-18 17:16:46.627031	2026-01-21 02:20:35.803
189	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	1.2e+07	3	f	2026-01-20 03:43:06.460387	2026-01-21 02:20:36.459
171	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.3e+06	2	f	2026-01-19 03:53:01.780957	2026-01-21 02:20:36.654
206	4596	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.144144e+06	1	f	2026-01-21 01:36:22.681806	2026-01-21 02:20:36.654
188	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	6.5e+06	1	f	2026-01-20 03:42:13.426737	2026-01-21 02:20:36.654
184	4597	cc78d40c-9179-4616-9834-9aa9c69963fa	520000	1	f	2026-01-20 02:35:50.140104	2026-01-21 02:20:36.768
202	4598	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.814453e+06	1	f	2026-01-20 23:46:10.189711	2026-01-21 02:30:41.802
186	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	900000	2	f	2026-01-20 02:52:48.070186	2026-01-21 02:30:41.802
200	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1e+06	2	f	2026-01-20 23:30:17.21284	2026-01-21 02:30:41.917
201	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.525e+06	1	f	2026-01-20 23:45:48.221954	2026-01-21 02:30:41.917
207	4601	51f792dc-04f3-467f-a604-631165c75b38	3e+06	1	f	2026-01-21 02:27:13.246406	2026-01-21 02:30:41.917
164	4604	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	6e+06	3	f	2026-01-18 22:05:37.229091	2026-01-21 02:30:42.116
198	4600	51f792dc-04f3-467f-a604-631165c75b38	500000	1	f	2026-01-20 22:28:21.078696	2026-01-21 02:30:43.639
142	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.414144e+06	3	f	2026-01-17 15:47:53.095399	2026-01-22 02:10:49.748
209	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.441441e+06	1	f	2026-01-21 06:23:36.831553	2026-01-22 02:00:47.513
222	4616	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	840000	1	f	2026-01-22 02:07:14.323127	2026-01-22 02:10:49.868
190	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.7e+06	1	f	2026-01-20 12:59:50.740418	2026-01-22 02:00:47.513
192	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	3.5e+06	2	f	2026-01-20 18:43:37.144369	2026-01-22 02:00:47.513
210	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.041441e+06	1	f	2026-01-21 06:44:10.058681	2026-01-22 02:00:47.744
221	4611	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	5.228379e+06	1	f	2026-01-22 01:46:33.509306	2026-01-22 02:00:47.513
214	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	800000	2	f	2026-01-21 15:14:36.400624	2026-01-22 02:00:47.744
199	4624	6f591686-4009-4693-a2c7-d3eb1b36073f	6.2e+06	3	f	2026-01-20 22:42:49.860171	2026-01-22 02:20:46.785
218	4624	e2831203-b5bb-4911-9a98-485fe4c6e3b5	9.95e+06	4	f	2026-01-21 19:59:51.015735	2026-01-22 02:20:46.785
197	4633	51f792dc-04f3-467f-a604-631165c75b38	5.1e+06	1	f	2026-01-20 22:22:29.93995	2026-01-22 02:30:53.765
178	4671	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.067523e+06	1	f	2026-01-19 23:24:22.531234	2026-01-23 02:30:56.09
226	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.044e+06	2	f	2026-01-22 05:46:57.317488	2026-01-23 02:20:40.385
211	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.25e+06	1	f	2026-01-21 14:08:14.292495	2026-01-23 02:00:48.433
223	4671	51f792dc-04f3-467f-a604-631165c75b38	3e+06	2	f	2026-01-22 02:36:01.925383	2026-01-23 02:30:56.09
231	4664	0477609b-080d-4cd2-b891-117e615bdf47	759754	2	f	2026-01-22 12:55:04.50625	2026-01-23 02:20:40.068
220	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	5e+06	1	f	2026-01-22 01:12:18.408175	2026-01-23 02:20:40.068
187	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	600000	2	f	2026-01-20 03:28:51.577582	2026-01-24 02:21:26.595
212	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1e+06	1	f	2026-01-21 14:11:11.99869	2026-01-24 02:11:18.712
213	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	1.5e+06	1	f	2026-01-21 14:45:25.655477	2026-01-24 02:11:20.725
205	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	1e+06	1	f	2026-01-21 01:30:02.998364	2026-01-24 02:11:20.725
224	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	2	f	2026-01-22 02:52:13.065056	2026-01-28 02:30:43.726
196	4748	51f792dc-04f3-467f-a604-631165c75b38	500000	1	f	2026-01-20 22:18:29.364996	2026-01-26 02:00:57.377
216	4731	4f229366-dbe3-4361-84cb-115cab42685f	2.549538e+07	5	f	2026-01-21 15:49:04.64449	2026-01-25 02:21:12.258
229	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.041e+06	1	f	2026-01-22 06:07:44.92358	2026-01-26 02:10:53.408
172	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	2e+06	2	f	2026-01-19 03:55:57.126108	2026-01-27 02:01:24.446
230	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.214444e+07	3	f	2026-01-22 06:11:53.939036	2026-01-28 02:23:15.992
203	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.75e+06	3	f	2026-01-21 00:48:37.465568	2026-01-28 02:30:43.837
227	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.414144e+06	1	f	2026-01-22 05:59:22.489444	2026-01-24 02:11:20.725
247	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	5.5e+06	1	f	2026-01-22 20:33:56.739089	2026-01-24 02:11:20.725
286	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.05e+06	2	f	2026-01-24 22:49:31.903377	2026-01-27 02:11:05.145
242	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.3e+06	1	f	2026-01-22 19:43:11.875206	2026-01-24 02:11:20.725
235	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.15e+06	2	f	2026-01-22 15:36:58.817491	2026-01-24 02:11:21.007
234	4686	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	f	2026-01-22 15:29:47.664429	2026-01-24 02:11:21.371
273	4692	4f229366-dbe3-4361-84cb-115cab42685f	600000	5	f	2026-01-23 23:48:13.30625	2026-01-24 02:21:26.595
265	4696	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	615000	1	f	2026-01-23 16:41:25.065499	2026-01-24 02:21:26.794
195	4647	51f792dc-04f3-467f-a604-631165c75b38	4e+06	2	f	2026-01-20 22:16:19.788946	2026-01-23 02:00:48.433
240	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.5e+06	1	f	2026-01-22 18:42:21.87285	2026-01-23 02:00:48.433
215	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.441144e+06	2	f	2026-01-21 15:18:03.271236	2026-01-23 02:00:48.899
239	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4e+06	1	f	2026-01-22 18:41:39.283337	2026-01-23 02:00:48.899
249	4653	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	520000	1	f	2026-01-23 00:34:24.411684	2026-01-23 02:10:47.759
254	4663	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	450000	1	f	2026-01-23 01:34:33.531606	2026-01-23 02:20:40.186
236	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.5e+06	1	f	2026-01-22 16:07:54.598274	2026-01-23 02:20:40.385
233	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.4e+07	1	f	2026-01-22 13:57:48.288572	2026-01-23 02:20:41.37
246	4660	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.635642e+07	1	f	2026-01-22 20:30:35.698522	2026-01-23 02:20:41.37
248	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3e+07	1	f	2026-01-22 23:21:23.137845	2026-01-23 02:20:41.37
257	4660	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3e+07	2	f	2026-01-23 02:19:41.386146	2026-01-23 02:20:41.37
244	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.2e+06	1	f	2026-01-22 20:28:31.532481	2026-01-23 02:30:56.09
250	4671	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.87e+06	1	f	2026-01-23 00:37:20.723307	2026-01-23 02:30:56.09
251	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	800000	1	f	2026-01-23 00:37:45.002316	2026-01-23 02:30:57.378
243	4691	6f591686-4009-4693-a2c7-d3eb1b36073f	5e+06	1	f	2026-01-22 19:47:19.115208	2026-01-24 02:21:27.607
294	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.2500999e+07	2	f	2026-01-25 03:12:51.861446	2026-01-26 02:30:55.259
281	4724	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.1e+06	3	f	2026-01-24 13:17:28.177537	2026-01-25 02:21:12.375
299	4756	6f591686-4009-4693-a2c7-d3eb1b36073f	4e+06	2	f	2026-01-25 15:02:02.462915	2026-01-26 02:10:53.28
269	4691	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	8.8e+06	1	f	2026-01-23 19:49:26.185675	2026-01-24 02:21:27.607
241	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.5e+06	1	f	2026-01-22 19:38:49.89532	2026-01-24 02:21:27.607
237	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.0555e+07	1	f	2026-01-22 17:08:53.713712	2026-01-24 02:21:27.607
238	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	1e+06	2	f	2026-01-22 18:40:30.581916	2026-01-24 02:01:16.613
245	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.5e+06	1	f	2026-01-22 20:29:45.685434	2026-01-24 02:01:16.613
277	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	894414	1	f	2026-01-24 01:25:56.938521	2026-01-24 02:01:18.913
262	4688	0477609b-080d-4cd2-b891-117e615bdf47	4.539473e+06	2	f	2026-01-23 04:02:49.127875	2026-01-24 02:11:18.712
263	4694	4f229366-dbe3-4361-84cb-115cab42685f	683550	5	f	2026-01-23 04:14:59.454955	2026-01-24 02:21:27.809
260	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	850000	2	f	2026-01-23 03:13:11.091728	2026-01-24 02:21:27.809
272	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.5e+06	2	f	2026-01-23 22:39:00.744586	2026-01-24 02:21:27.809
266	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.2e+06	1	f	2026-01-23 17:44:36.680276	2026-01-24 02:21:27.809
264	4701	cc78d40c-9179-4616-9834-9aa9c69963fa	450000	1	f	2026-01-23 13:32:51.063937	2026-01-24 02:31:32.512
261	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	1e+06	2	f	2026-01-23 03:15:43.902819	2026-01-24 02:31:35.113
278	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.74881e+06	1	f	2026-01-24 01:39:30.289066	2026-01-24 02:31:35.113
255	4789	388f55c3-52e1-499f-8a56-948636a8c205	2.2e+06	2	f	2026-01-23 01:55:42.717289	2026-01-27 02:11:04.251
295	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.000099e+06	1	f	2026-01-25 03:32:51.30495	2026-01-27 02:21:05.905
267	4715	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	2e+06	2	f	2026-01-23 18:50:14.697371	2026-01-25 02:01:09.534
289	4738	17faf686-27d1-4e30-a11c-4e7ec21ca685	650999	2	f	2026-01-25 00:57:44.050015	2026-01-25 02:33:28.288
274	4731	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.5e+07	5	f	2026-01-24 00:04:00.64915	2026-01-25 02:21:12.258
291	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	7e+06	2	f	2026-01-25 02:16:44.063656	2026-01-25 02:21:12.375
256	4729	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.5e+07	3	f	2026-01-23 02:03:05.557205	2026-01-25 02:21:15.794
258	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.4e+07	1	f	2026-01-23 02:24:53.578002	2026-01-25 02:21:15.794
290	4729	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2.1e+07	2	f	2026-01-25 02:16:01.408183	2026-01-25 02:21:15.794
292	4729	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.6e+07	2	f	2026-01-25 02:17:11.711749	2026-01-25 02:21:15.794
293	4729	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2e+07	3	f	2026-01-25 02:19:46.536677	2026-01-25 02:21:15.794
283	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.5e+06	1	f	2026-01-24 18:01:10.357477	2026-01-25 02:33:28.401
268	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	1e+06	2	f	2026-01-23 18:50:38.931506	2026-01-26 02:00:57.504
275	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.5e+06	1	f	2026-01-24 00:46:16.065431	2026-01-26 02:00:57.377
297	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.4e+07	3	f	2026-01-25 14:22:33.528192	2026-01-28 02:23:15.992
280	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.5e+06	1	f	2026-01-24 03:44:08.797922	2026-01-27 02:21:06.019
284	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	8.7e+06	3	f	2026-01-24 18:35:48.150092	2026-01-28 02:01:46.491
276	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.5e+06	1	f	2026-01-24 00:46:33.801988	2026-01-26 02:00:57.504
301	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	5e+06	1	f	2026-01-25 16:29:53.734026	2026-01-26 02:10:53.408
279	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	800000	2	f	2026-01-24 03:42:37.253875	2026-01-26 02:30:54.594
300	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	9e+06	1	f	2026-01-25 16:20:21.228205	2026-01-26 02:30:54.8
282	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.86e+06	2	f	2026-01-24 17:59:41.793338	2026-01-28 02:01:49.791
271	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	4e+06	4	f	2026-01-23 21:54:09.030915	2026-01-26 02:21:03.801
296	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	2.5e+06	2	f	2026-01-25 13:29:02.434962	2026-01-26 02:30:54.479
298	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	3.3e+06	2	f	2026-01-25 15:00:16.133916	2026-01-26 02:30:54.479
259	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.6e+06	2	f	2026-01-23 02:57:15.131231	2026-01-26 02:30:54.8
252	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	3e+06	2	f	2026-01-23 00:59:37.672637	2026-01-28 02:23:16.592
287	4789	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.26e+06	2	f	2026-01-24 22:51:11.990169	2026-01-27 02:11:04.251
302	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	2e+06	2	f	2026-01-25 16:58:45.493866	2026-01-27 02:21:06.019
253	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	2e+06	3	f	2026-01-23 01:00:47.924782	2026-01-28 02:12:32.092
317	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	2e+06	2	f	2026-01-26 13:19:39.011724	2026-01-27 02:21:06.019
321	4794	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	f	2026-01-26 22:29:20.132881	2026-01-27 02:21:06.132
288	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.500999e+06	1	f	2026-01-24 23:46:45.780838	2026-01-28 02:23:16.592
330	4802	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.441444e+06	1	f	2026-01-27 02:20:41.945777	2026-01-27 02:31:04.608
323	4802	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	969975	2	f	2026-01-26 23:54:52.475428	2026-01-27 02:31:04.608
270	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	2.5e+06	2	f	2026-01-23 21:44:18.145039	2026-01-26 02:00:57.377
305	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.5e+06	1	f	2026-01-26 00:58:20.262411	2026-01-26 02:00:57.377
312	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.423132e+06	3	f	2026-01-26 01:45:23.676896	2026-01-26 02:10:53.28
313	4756	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.15e+07	1	f	2026-01-26 01:57:59.085238	2026-01-26 02:10:53.28
309	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.55e+07	1	f	2026-01-26 01:01:25.83264	2026-01-26 02:10:53.28
306	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.5e+06	1	f	2026-01-26 00:59:28.386583	2026-01-26 02:10:53.408
311	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.944144e+06	2	f	2026-01-26 01:20:33.170609	2026-01-26 02:30:54.479
307	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.52e+06	1	f	2026-01-26 01:00:30.600197	2026-01-26 02:30:54.594
314	4772	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.741144e+06	1	f	2026-01-26 02:28:52.899957	2026-01-26 02:30:54.594
310	4774	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	7.5e+06	1	f	2026-01-26 01:02:37.680802	2026-01-26 02:30:54.8
304	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	6e+06	2	f	2026-01-25 21:57:06.118603	2026-01-26 02:30:55.259
308	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.62e+07	1	f	2026-01-26 01:00:55.282047	2026-01-26 02:30:55.259
337	4827	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.5e+06	1	f	2026-01-27 16:23:29.305953	2026-01-28 02:23:16.592
339	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1e+06	1	f	2026-01-27 21:15:42.019508	2026-01-28 02:23:25.592
322	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	800000	1	f	2026-01-26 22:31:22.398887	2026-01-28 02:23:25.592
319	4781	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.3e+07	1	f	2026-01-26 15:24:12.172842	2026-01-27 02:01:26.979
326	4781	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2e+07	1	f	2026-01-27 01:15:27.171684	2026-01-27 02:01:26.979
327	4784	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	525000	2	f	2026-01-27 02:03:39.049823	2026-01-27 02:11:04.048
329	4789	cc78d40c-9179-4616-9834-9aa9c69963fa	2.8783e+06	2	f	2026-01-27 02:07:07.421417	2026-01-27 02:11:04.251
320	4790	5084741d-1673-42b3-a8e3-3d422874e814	6.8e+06	3	f	2026-01-26 20:59:29.464567	2026-01-27 02:11:04.369
315	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.744144e+06	1	f	2026-01-26 02:33:23.231491	2026-01-27 02:11:05.145
318	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	2e+06	2	f	2026-01-26 13:22:52.205341	2026-01-27 02:11:05.145
316	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	1.5e+06	2	f	2026-01-26 13:18:55.898337	2026-01-27 02:21:05.905
324	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.6e+06	2	f	2026-01-27 00:21:08.247571	2026-01-27 02:21:05.905
328	4792	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	3.25e+06	1	f	2026-01-27 02:04:25.15781	2026-01-27 02:21:05.905
344	4833	f335b9c3-7d63-44f3-9540-13b1d461ca13	1e+06	2	f	2026-01-28 02:04:54.892128	2026-01-28 02:23:25.592
338	4814	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.62263e+06	2	f	2026-01-27 17:57:24.63215	2026-01-28 02:01:46.491
303	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	5e+06	3	f	2026-01-25 17:05:00.867783	2026-01-28 02:01:46.491
334	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.25e+07	1	f	2026-01-27 16:20:10.865199	2026-01-28 02:01:46.491
331	4807	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	750000	1	f	2026-01-27 02:57:30.688484	2026-01-28 02:01:46.991
335	4812	e2831203-b5bb-4911-9a98-485fe4c6e3b5	755000	2	f	2026-01-27 16:21:14.971758	2026-01-28 02:01:47.491
343	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	9.5e+06	1	f	2026-01-28 01:59:43.480491	2026-01-28 02:01:49.791
325	4843	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1e+07	3	f	2026-01-27 00:25:35.092124	2026-01-28 02:30:43.611
333	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2e+06	1	f	2026-01-27 14:19:46.431869	2026-01-28 02:30:43.726
332	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.25e+06	2	f	2026-01-27 02:57:57.888788	2026-01-28 02:30:43.837
336	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.5e+06	1	f	2026-01-27 16:22:24.752916	2026-01-28 02:12:32.092
345	4823	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	625000	2	f	2026-01-28 02:05:56.498434	2026-01-28 02:12:35.692
342	4824	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1e+06	1	f	2026-01-27 21:18:23.670597	2026-01-28 02:12:36.292
340	4839	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1e+06	1	f	2026-01-27 21:16:48.831237	2026-01-28 02:30:44.542
341	4842	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1e+06	1	f	2026-01-27 21:18:06.216015	2026-01-28 02:30:44.746
\.


--
-- Data for Name: bid_bundle_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bid_bundle_items (id, bundle_id, free_agent_id, priority, amount, years, status, bid_id, activated_at, created_at) FROM stdin;
13	4	1481	2	950000	2	pending	\N	\N	2025-12-25 23:30:45.364709
12	4	1482	1	800000	1	won	55	2025-12-25 23:30:45.348	2025-12-25 23:30:45.364709
14	5	1931	1	600000	1	outbid	86	2026-01-09 20:47:49.318	2026-01-09 20:47:49.334769
15	5	1933	2	2e+06	1	outbid	93	2026-01-09 20:47:50.69	2026-01-09 20:47:49.334769
18	7	1962	2	1.2e+07	5	pending	\N	\N	2026-01-10 01:00:57.633283
19	7	1953	3	750000	5	pending	\N	\N	2026-01-10 01:00:57.633283
16	6	1936	1	400000	1	won	91	2026-01-09 20:59:27.772	2026-01-09 20:59:27.788439
17	7	1951	1	7.5e+06	5	won	100	2026-01-10 01:00:57.617	2026-01-10 01:00:57.633283
22	8	4400	1	5e+06	2	outbid	220	2026-01-13 17:57:28.152	2026-01-13 17:57:28.170207
24	9	4814	2	3e+06	2	skipped	\N	2026-01-23 14:46:24.322	2026-01-23 14:46:23.436254
23	9	4832	1	8.1e+06	3	skipped	\N	2026-01-23 14:46:23.421	2026-01-23 14:46:23.436254
\.


--
-- Data for Name: bid_bundles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bid_bundles (id, auction_id, user_id, name, status, active_item_priority, created_at, updated_at) FROM stdin;
4	4	388f55c3-52e1-499f-8a56-948636a8c205	Utility	completed	1	2025-12-25 23:30:45.315275	2025-12-28 01:21:06.912
5	4	cc78d40c-9179-4616-9834-9aa9c69963fa	Bundle 1/9/2026	completed	2	2026-01-09 20:47:49.292256	2026-01-09 22:14:28.049
6	4	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	OF	completed	1	2026-01-09 20:59:27.753037	2026-01-10 01:13:02.54
7	4	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	Bundle 1/9/2026	completed	1	2026-01-10 01:00:57.592433	2026-01-10 01:22:13.639
8	10	388f55c3-52e1-499f-8a56-948636a8c205	Relievers	completed	1	2026-01-13 17:51:18.282077	2026-01-14 01:44:29.232
9	10	388f55c3-52e1-499f-8a56-948636a8c205	SS	active	2	2026-01-23 14:46:23.395156	2026-01-23 14:46:25.145
\.


--
-- Data for Name: bids; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bids (id, free_agent_id, user_id, amount, years, total_value, is_auto_bid, created_at, is_imported_initial) FROM stdin;
53	1460	388f55c3-52e1-499f-8a56-948636a8c205	4.604518e+06	3	6.124009e+06	t	2025-12-25 21:08:39.23557	f
54	1469	388f55c3-52e1-499f-8a56-948636a8c205	500000	1	500000	t	2025-12-25 21:09:00.988275	f
55	1482	388f55c3-52e1-499f-8a56-948636a8c205	400000	1	400000	t	2025-12-25 23:30:46.127182	f
56	1463	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	654384	1	654384	f	2025-12-26 17:36:11.766633	f
57	1486	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	400000	4	572000	f	2025-12-26 17:38:14.624199	f
58	1462	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	400000	1	400000	f	2025-12-27 04:30:39.269573	f
59	1458	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	500000	f	2025-12-27 13:35:06.868185	f
60	1460	7779ed21-af49-4fbd-8127-c5a869384569	5.144168e+06	2	6.43021e+06	t	2025-12-27 20:35:31.668639	f
61	1460	388f55c3-52e1-499f-8a56-948636a8c205	5.076482e+06	3	6.751721e+06	t	2025-12-27 20:35:32.058269	f
62	1460	7779ed21-af49-4fbd-8127-c5a869384569	5.671446e+06	2	7.0893075e+06	t	2025-12-27 20:35:32.40951	f
63	1460	388f55c3-52e1-499f-8a56-948636a8c205	5.596822e+06	3	7.4437735e+06	t	2025-12-27 20:35:32.736745	f
64	1460	7779ed21-af49-4fbd-8127-c5a869384569	6.25277e+06	2	7.8159625e+06	t	2025-12-27 20:35:33.067172	f
65	1522	388f55c3-52e1-499f-8a56-948636a8c205	2.697591e+06	1	2.697591e+06	f	2025-12-29 01:03:15.608158	f
66	1531	388f55c3-52e1-499f-8a56-948636a8c205	678240	1	678240	t	2025-12-29 01:04:18.716931	f
67	1738	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	f	2026-01-04 01:27:16.171856	f
68	1746	4f229366-dbe3-4361-84cb-115cab42685f	740000	1	740000	f	2026-01-04 18:22:50.517361	f
69	1749	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-04 18:23:13.019396	f
70	1763	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	t	2026-01-04 18:24:43.87741	f
71	1783	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	645000	3	857850	f	2026-01-05 16:45:54.936934	f
72	1962	cc78d40c-9179-4616-9834-9aa9c69963fa	6.919101e+06	3	9.202404e+06	t	2026-01-09 13:07:22.854017	f
73	1932	e2831203-b5bb-4911-9a98-485fe4c6e3b5	400000	3	532000	f	2026-01-09 14:01:54.204494	f
74	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	400000	4	572000	t	2026-01-09 14:02:56.610467	f
75	1962	e2831203-b5bb-4911-9a98-485fe4c6e3b5	8e+06	3	1.064e+07	f	2026-01-09 14:03:59.244038	f
76	1931	6f591686-4009-4693-a2c7-d3eb1b36073f	400000	3	532000	t	2026-01-09 14:46:19.326148	f
77	1934	0477609b-080d-4cd2-b891-117e615bdf47	420000	4	600600	f	2026-01-09 14:46:59.906273	f
78	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	441000	4	630630	t	2026-01-09 14:47:00.297209	f
79	1934	0477609b-080d-4cd2-b891-117e615bdf47	463050	4	662161.5	t	2026-01-09 14:47:33.864751	f
80	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	486203	4	695270.3	t	2026-01-09 14:47:34.247162	f
81	1934	0477609b-080d-4cd2-b891-117e615bdf47	510514	4	730035	t	2026-01-09 14:47:34.584225	f
82	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	536040	4	766537.2	t	2026-01-09 14:47:34.900401	f
83	1934	0477609b-080d-4cd2-b891-117e615bdf47	562842	4	804864.06	t	2026-01-09 14:47:35.220058	f
84	1934	e2831203-b5bb-4911-9a98-485fe4c6e3b5	590985	4	845108.56	t	2026-01-09 14:47:35.546768	f
85	1934	0477609b-080d-4cd2-b891-117e615bdf47	620535	4	887365.06	t	2026-01-09 14:47:35.862403	f
86	1931	cc78d40c-9179-4616-9834-9aa9c69963fa	558600	1	558600	t	2026-01-09 20:47:50.038231	f
87	1931	6f591686-4009-4693-a2c7-d3eb1b36073f	441000	3	586530	t	2026-01-09 20:47:50.498513	f
88	1933	cc78d40c-9179-4616-9834-9aa9c69963fa	1.500055e+06	1	1.500055e+06	t	2026-01-09 20:47:51.34126	f
89	1933	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.6e+06	1	1.6e+06	f	2026-01-09 20:57:09.977155	f
90	1933	cc78d40c-9179-4616-9834-9aa9c69963fa	1.68e+06	1	1.68e+06	t	2026-01-09 20:57:10.38213	f
91	1936	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	t	2026-01-09 20:59:28.480539	f
92	1933	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.764e+06	1	1.764e+06	f	2026-01-09 22:07:58.102334	f
93	1933	cc78d40c-9179-4616-9834-9aa9c69963fa	1.8522e+06	1	1.8522e+06	t	2026-01-09 22:07:58.554512	f
94	1951	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.214915e+06	1	3.214915e+06	f	2026-01-09 22:10:31.114489	f
95	1933	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.94481e+06	1	1.94481e+06	t	2026-01-09 22:14:27.807353	f
96	1951	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.214915e+06	4	4.5973285e+06	f	2026-01-09 23:37:31.07233	f
97	1933	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.535377e+06	3	2.0420514e+06	t	2026-01-10 00:56:30.899491	f
98	1933	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.144154e+06	1	2.144154e+06	t	2026-01-10 00:56:31.275855	f
99	1933	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.692754e+06	3	2.2513628e+06	t	2026-01-10 00:56:31.619805	f
100	1951	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.214915e+06	5	4.983118e+06	t	2026-01-10 00:57:58.583338	f
101	1939	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	400000	1	400000	f	2026-01-10 01:01:41.564401	f
122	4365	7779ed21-af49-4fbd-8127-c5a869384569	2.2476116e+07	1	2.2476116e+07	f	2026-01-11 23:29:35.639595	t
123	4366	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.41708e+06	1	5.41708e+06	f	2026-01-11 23:29:35.710472	t
124	4399	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	2.4e+07	1	2.4e+07	f	2026-01-11 23:29:35.774111	t
125	4400	51f792dc-04f3-467f-a604-631165c75b38	3.982089e+06	1	3.982089e+06	f	2026-01-11 23:29:35.838342	t
126	4437	51f792dc-04f3-467f-a604-631165c75b38	1.6520056e+07	1	1.6520056e+07	f	2026-01-11 23:29:35.905323	t
127	4379	02538c92-2a46-43e6-8351-33297d6de099	8.879935e+06	3	1.1810314e+07	f	2026-01-12 14:19:06.463892	f
128	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	8.879935e+06	4	1.2698307e+07	t	2026-01-12 14:19:06.907335	f
129	4390	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.5e+06	2	1.875e+06	f	2026-01-12 14:49:30.489371	f
130	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	481200	2	601500	f	2026-01-12 14:49:48.559977	f
131	4394	c4815f14-1981-43aa-b972-5f7a43ed0f13	2e+06	3	2.66e+06	f	2026-01-12 14:51:52.844025	f
132	4371	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-12 18:25:20.914918	f
133	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	3	532000	t	2026-01-12 18:25:21.408744	f
134	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	500000	1	500000	f	2026-01-12 18:26:17.792286	f
135	4390	6f591686-4009-4693-a2c7-d3eb1b36073f	1.575e+06	2	1.96875e+06	f	2026-01-12 20:04:12.924307	f
136	4374	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	525000	1	525000	f	2026-01-12 20:23:53.78026	f
137	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	551250	1	551250	t	2026-01-12 20:23:54.178401	f
138	4374	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	578813	1	578813	f	2026-01-12 20:24:28.08619	f
139	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	607754	1	607754	t	2026-01-12 20:24:28.478054	f
140	4374	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	738142	1	738142	f	2026-01-12 20:25:05.436766	f
141	4371	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	3	558600	f	2026-01-12 20:26:35.669927	f
142	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	441000	3	586530	t	2026-01-12 20:26:36.070061	f
143	4394	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.1e+06	3	2.793e+06	f	2026-01-12 20:30:12.216449	f
144	4370	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.2913587e+07	2	1.6141984e+07	f	2026-01-12 21:32:56.306293	f
145	4370	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.3559267e+07	2	1.6949084e+07	t	2026-01-12 21:32:56.803087	f
146	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	775050	1	775050	t	2026-01-12 21:48:29.626636	f
147	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	813803	1	813803	f	2026-01-12 21:48:54.753543	f
148	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	854494	1	854494	t	2026-01-12 21:48:55.145196	f
149	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	897219	1	897219	f	2026-01-12 21:49:03.356269	f
150	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	942080	1	942080	t	2026-01-12 21:49:03.736265	f
151	4844	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	700000	5	1.085e+06	f	2026-01-12 21:52:46.493373	f
152	4371	e2831203-b5bb-4911-9a98-485fe4c6e3b5	550000	3	731500	f	2026-01-12 22:22:31.268992	f
153	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	577500	3	768075	t	2026-01-12 22:22:31.671405	f
154	4371	e2831203-b5bb-4911-9a98-485fe4c6e3b5	755000	3	1.00415e+06	f	2026-01-12 22:23:36.616691	f
155	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	792750	3	1.0543575e+06	t	2026-01-12 22:23:36.998814	f
156	4371	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.111e+06	3	1.47763e+06	f	2026-01-12 22:24:22.540351	f
157	4379	e2831203-b5bb-4911-9a98-485fe4c6e3b5	9.555e+06	4	1.366365e+07	f	2026-01-12 22:26:25.494798	f
158	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.003275e+07	4	1.4346832e+07	t	2026-01-12 22:26:25.909916	f
159	4379	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.2555e+07	4	1.795365e+07	f	2026-01-12 22:33:28.604564	f
160	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.318275e+07	4	1.8851332e+07	t	2026-01-12 22:33:28.99167	f
161	4390	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.25e+06	2	4.0625e+06	f	2026-01-12 22:34:37.080151	f
162	4374	5d77ac22-c768-4d3b-99d8-73c250a3e859	989184	1	989184	f	2026-01-12 22:57:13.231489	f
163	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.038644e+06	1	1.038644e+06	t	2026-01-12 22:57:13.617936	f
164	4394	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.333412e+06	2	4.166765e+06	f	2026-01-12 23:00:16.49042	f
165	4394	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.289552e+06	3	4.375104e+06	f	2026-01-13 00:55:26.092584	f
166	4390	51f792dc-04f3-467f-a604-631165c75b38	4.265625e+06	1	4.265625e+06	f	2026-01-13 01:52:27.855305	f
167	4394	51f792dc-04f3-467f-a604-631165c75b38	3.45403e+06	3	4.59386e+06	f	2026-01-13 01:53:19.595121	f
168	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	856579	3	1.1392501e+06	f	2026-01-13 02:25:40.1953	f
169	4379	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.5835119e+07	2	1.9793898e+07	t	2026-01-13 02:29:46.988964	f
170	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.4533982e+07	4	2.0783594e+07	t	2026-01-13 02:29:47.380452	f
171	4379	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.745822e+07	2	2.1822774e+07	t	2026-01-13 02:29:47.758837	f
172	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.6023716e+07	4	2.2913914e+07	t	2026-01-13 02:29:48.11085	f
173	4379	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.9247688e+07	2	2.405961e+07	t	2026-01-13 02:29:48.444847	f
174	4379	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.7666148e+07	4	2.5262592e+07	t	2026-01-13 03:13:15.460881	f
175	4412	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	4.4e+06	1	4.4e+06	f	2026-01-13 15:11:29.528213	f
176	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.38391e+06	3	5.8306005e+06	t	2026-01-13 15:11:29.980019	f
177	4425	5d77ac22-c768-4d3b-99d8-73c250a3e859	544612	1	544612	f	2026-01-13 15:16:48.255477	f
178	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.697591e+06	1	2.697591e+06	f	2026-01-13 15:49:26.267166	f
179	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	1	400000	f	2026-01-13 16:07:39.557471	f
180	4370	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.779654e+07	1	1.779654e+07	t	2026-01-13 16:11:07.337712	f
181	4387	388f55c3-52e1-499f-8a56-948636a8c205	400000	1	400000	t	2026-01-13 17:09:09.533276	f
182	4408	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-13 17:23:38.44232	f
183	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	2	500000	t	2026-01-13 17:23:38.824985	f
184	4408	5d77ac22-c768-4d3b-99d8-73c250a3e859	525000	1	525000	f	2026-01-13 17:23:59.438862	f
185	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	441000	2	551250	t	2026-01-13 17:23:59.816566	f
186	4429	5d77ac22-c768-4d3b-99d8-73c250a3e859	420000	1	420000	f	2026-01-13 17:25:08.462142	f
187	4431	5d77ac22-c768-4d3b-99d8-73c250a3e859	759229	1	759229	f	2026-01-13 17:25:21.273708	f
188	4408	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	463050	2	578812.5	f	2026-01-13 17:30:25.072336	f
189	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	486203	2	607753.75	t	2026-01-13 17:30:25.451331	f
190	4408	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	534824	2	668530	f	2026-01-13 17:30:39.444402	f
191	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	561566	2	701957.5	t	2026-01-13 17:30:39.825325	f
192	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.832471e+06	1	2.832471e+06	t	2026-01-13 17:31:11.399506	f
193	4390	6f591686-4009-4693-a2c7-d3eb1b36073f	3.583125e+06	2	4.478906e+06	f	2026-01-13 17:34:44.832418	f
194	4371	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.16655e+06	3	1.5515115e+06	f	2026-01-13 17:39:31.496699	f
195	4844	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	899408	3	1.1962126e+06	f	2026-01-13 17:42:28.14068	f
196	4400	388f55c3-52e1-499f-8a56-948636a8c205	3.982089e+06	2	4.977611e+06	t	2026-01-13 17:51:19.170019	f
197	4366	388f55c3-52e1-499f-8a56-948636a8c205	5.41708e+06	2	6.77135e+06	t	2026-01-13 17:57:52.767135	f
198	4375	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	500000	t	2026-01-13 18:42:57.330341	f
199	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	500000	t	2026-01-13 18:48:56.920397	f
200	4387	388f55c3-52e1-499f-8a56-948636a8c205	525000	1	525000	t	2026-01-13 18:48:57.2976	f
201	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	441000	2	551250	t	2026-01-13 18:48:57.635927	f
202	4387	388f55c3-52e1-499f-8a56-948636a8c205	578813	1	578813	t	2026-01-13 18:48:57.952619	f
203	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	486203	2	607753.75	t	2026-01-13 18:48:58.297541	f
204	4387	388f55c3-52e1-499f-8a56-948636a8c205	638142	1	638142	t	2026-01-13 18:48:58.609461	f
205	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	536040	2	670050	t	2026-01-13 18:48:58.925472	f
206	4387	388f55c3-52e1-499f-8a56-948636a8c205	703553	1	703553	t	2026-01-13 18:48:59.259261	f
207	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	590985	2	738731.25	t	2026-01-13 18:48:59.579124	f
208	4387	388f55c3-52e1-499f-8a56-948636a8c205	775668	1	775668	t	2026-01-13 18:48:59.907479	f
209	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	944379	3	1.2560241e+06	f	2026-01-13 19:11:01.543144	f
210	4427	6f591686-4009-4693-a2c7-d3eb1b36073f	2.974095e+06	1	2.974095e+06	f	2026-01-13 19:14:14.553003	f
211	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.697591e+06	2	3.3719888e+06	f	2026-01-13 19:17:43.307467	f
212	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	651562	2	814452.5	t	2026-01-14 01:39:00.936321	f
213	4387	388f55c3-52e1-499f-8a56-948636a8c205	855176	1	855176	t	2026-01-14 01:39:01.382134	f
214	4387	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	718348	2	897935	t	2026-01-14 01:39:01.719522	f
215	4387	388f55c3-52e1-499f-8a56-948636a8c205	942832	1	942832	t	2026-01-14 01:39:02.047884	f
216	4390	51f792dc-04f3-467f-a604-631165c75b38	4.702852e+06	1	4.702852e+06	t	2026-01-14 01:43:51.309851	f
217	4400	51f792dc-04f3-467f-a604-631165c75b38	4.181194e+06	2	5.2264925e+06	t	2026-01-14 01:44:27.508341	f
218	4400	388f55c3-52e1-499f-8a56-948636a8c205	4.390254e+06	2	5.4878175e+06	t	2026-01-14 01:44:27.949202	f
219	4400	51f792dc-04f3-467f-a604-631165c75b38	4.609767e+06	2	5.762209e+06	t	2026-01-14 01:44:28.336032	f
220	4400	388f55c3-52e1-499f-8a56-948636a8c205	4.840256e+06	2	6.05032e+06	t	2026-01-14 01:44:28.662021	f
221	4400	51f792dc-04f3-467f-a604-631165c75b38	5.082269e+06	2	6.352836e+06	t	2026-01-14 01:44:29.033007	f
222	4364	51f792dc-04f3-467f-a604-631165c75b38	400000	3	532000	t	2026-01-14 01:49:45.973663	f
223	4371	cc78d40c-9179-4616-9834-9aa9c69963fa	1.30327e+06	2	1.6290875e+06	t	2026-01-14 03:04:56.320132	f
224	4425	c4815f14-1981-43aa-b972-5f7a43ed0f13	571843	1	571843	f	2026-01-14 03:17:29.715909	f
225	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	441000	1	441000	f	2026-01-14 03:17:49.628204	f
226	4370	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.4949094e+07	2	1.8686368e+07	t	2026-01-14 04:02:51.605816	f
227	4370	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.9620688e+07	1	1.9620688e+07	t	2026-01-14 04:02:52.152981	f
228	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.286122e+06	3	1.7105422e+06	t	2026-01-14 04:05:19.66122	f
229	4371	cc78d40c-9179-4616-9834-9aa9c69963fa	1.436856e+06	2	1.79607e+06	t	2026-01-14 04:05:20.046109	f
230	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.41795e+06	3	1.8858735e+06	t	2026-01-14 04:05:20.403493	f
231	4371	cc78d40c-9179-4616-9834-9aa9c69963fa	1.584134e+06	2	1.9801675e+06	t	2026-01-14 04:05:20.736618	f
232	4371	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.563291e+06	3	2.079177e+06	t	2026-01-14 04:05:21.080249	f
233	4370	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.6481378e+07	2	2.0601722e+07	t	2026-01-14 04:31:01.517196	f
234	4400	388f55c3-52e1-499f-8a56-948636a8c205	5.336383e+06	2	6.670479e+06	t	2026-01-14 05:12:15.97855	f
235	4400	51f792dc-04f3-467f-a604-631165c75b38	5.603203e+06	2	7.004004e+06	t	2026-01-14 05:12:16.381139	f
236	4400	388f55c3-52e1-499f-8a56-948636a8c205	5.883364e+06	2	7.354205e+06	t	2026-01-14 05:12:16.740601	f
237	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	2	500000	t	2026-01-14 06:26:37.741145	f
238	4844	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	991598	3	1.3188254e+06	f	2026-01-14 06:32:52.142532	f
239	4394	388f55c3-52e1-499f-8a56-948636a8c205	3.11197e+06	5	4.8235535e+06	t	2026-01-14 06:33:29.32689	f
240	4376	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	400000	4	572000	f	2026-01-14 12:12:38.833029	f
241	4371	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.122e+06	3	2.82226e+06	f	2026-01-14 12:47:15.335198	f
242	4390	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.25e+06	2	5.3125e+06	f	2026-01-14 12:50:53.200542	f
243	4390	51f792dc-04f3-467f-a604-631165c75b38	5.578125e+06	1	5.578125e+06	t	2026-01-14 12:50:53.662819	f
244	4390	e2831203-b5bb-4911-9a98-485fe4c6e3b5	6.5e+06	1	6.5e+06	f	2026-01-14 12:54:58.433236	f
245	4390	51f792dc-04f3-467f-a604-631165c75b38	6.825e+06	1	6.825e+06	t	2026-01-14 12:54:58.879379	f
246	4425	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.5e+06	1	1.5e+06	f	2026-01-14 13:00:26.470445	f
247	4431	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.2555e+06	1	1.2555e+06	f	2026-01-14 13:02:14.229982	f
248	4390	e2831203-b5bb-4911-9a98-485fe4c6e3b5	8e+06	1	8e+06	f	2026-01-14 13:11:44.418578	f
249	4393	cc78d40c-9179-4616-9834-9aa9c69963fa	481200	3	639996	t	2026-01-14 13:26:33.731223	f
250	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	537597	2	671996.25	t	2026-01-14 13:26:34.177061	f
251	4393	cc78d40c-9179-4616-9834-9aa9c69963fa	530524	3	705596.94	t	2026-01-14 13:26:34.564186	f
252	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	592702	2	740877.5	t	2026-01-14 13:26:34.976962	f
253	4393	cc78d40c-9179-4616-9834-9aa9c69963fa	584904	3	777922.3	t	2026-01-14 13:26:35.366684	f
254	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	653455	2	816818.75	t	2026-01-14 13:26:35.762397	f
255	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	1.041178e+06	3	1.3847668e+06	f	2026-01-14 13:31:32.338683	f
256	4458	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.747111e+06	2	5.933889e+06	t	2026-01-14 14:20:44.34979	f
257	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	500000	t	2026-01-14 14:30:37.209962	f
258	4425	6f591686-4009-4693-a2c7-d3eb1b36073f	1.75e+06	1	1.75e+06	f	2026-01-14 14:35:35.704476	f
259	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	3.3e+06	5	5.115e+06	f	2026-01-14 14:41:10.548814	f
260	4394	388f55c3-52e1-499f-8a56-948636a8c205	3.465e+06	5	5.37075e+06	t	2026-01-14 14:41:10.991752	f
261	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	3.63825e+06	5	5.6392875e+06	t	2026-01-14 14:45:11.460903	f
262	4394	388f55c3-52e1-499f-8a56-948636a8c205	3.820163e+06	5	5.9212525e+06	t	2026-01-14 14:45:11.906808	f
263	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	4.011172e+06	5	6.2173165e+06	t	2026-01-14 14:45:12.290551	f
264	4394	388f55c3-52e1-499f-8a56-948636a8c205	4.211731e+06	5	6.528183e+06	t	2026-01-14 14:45:12.681361	f
265	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	4.422318e+06	5	6.854593e+06	t	2026-01-14 14:45:13.069648	f
266	4394	388f55c3-52e1-499f-8a56-948636a8c205	4.643434e+06	5	7.1973225e+06	t	2026-01-14 14:45:13.450266	f
267	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	5e+06	5	7.75e+06	f	2026-01-14 14:47:05.583599	f
268	4394	388f55c3-52e1-499f-8a56-948636a8c205	5.25e+06	5	8.1375e+06	t	2026-01-14 14:47:06.035425	f
269	4375	5d77ac22-c768-4d3b-99d8-73c250a3e859	525000	1	525000	f	2026-01-14 14:49:02.037457	f
270	4375	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	441000	2	551250	t	2026-01-14 14:49:02.480677	f
271	4375	5d77ac22-c768-4d3b-99d8-73c250a3e859	578813	1	578813	f	2026-01-14 14:49:16.412317	f
272	4375	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	486203	2	607753.75	t	2026-01-14 14:49:16.846873	f
273	4394	6f591686-4009-4693-a2c7-d3eb1b36073f	6e+06	5	9.3e+06	f	2026-01-14 14:49:25.853749	f
274	4394	388f55c3-52e1-499f-8a56-948636a8c205	6.3e+06	5	9.765e+06	t	2026-01-14 14:49:26.307146	f
275	4429	5d77ac22-c768-4d3b-99d8-73c250a3e859	463050	1	463050	f	2026-01-14 14:55:05.332319	f
276	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	2	500000	t	2026-01-14 14:58:52.36544	f
277	4844	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.5e+06	3	3.325e+06	f	2026-01-14 15:00:14.214167	f
278	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	2.625e+06	3	3.49125e+06	t	2026-01-14 15:04:47.857013	f
279	4390	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	8.4e+06	1	8.4e+06	t	2026-01-14 15:17:59.707552	f
280	4455	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-14 15:20:47.728555	f
281	4393	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	686128	2	857660	f	2026-01-14 16:07:23.243127	f
282	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	720435	2	900543.75	t	2026-01-14 16:07:23.685808	f
283	4393	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	792479	2	990598.75	f	2026-01-14 16:07:39.453935	f
284	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	832103	2	1.04012875e+06	t	2026-01-14 16:07:39.891962	f
285	4393	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	860257	3	1.1441418e+06	f	2026-01-14 16:08:20.397317	f
286	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	961080	2	1.20135e+06	t	2026-01-14 16:08:20.834337	f
287	4393	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	993598	3	1.3214854e+06	f	2026-01-14 16:08:29.21883	f
288	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.110048e+06	2	1.38756e+06	t	2026-01-14 16:08:29.681407	f
289	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	2	525000	f	2026-01-14 16:10:39.526394	f
290	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	441000	2	551250	t	2026-01-14 16:10:39.962236	f
291	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	600000	2	750000	f	2026-01-14 16:10:56.885141	f
292	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	630000	2	787500	t	2026-01-14 16:10:57.337856	f
293	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	800000	2	1e+06	f	2026-01-14 16:11:09.7603	f
294	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	840000	2	1.05e+06	t	2026-01-14 16:11:10.223424	f
295	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	900000	2	1.125e+06	f	2026-01-14 16:11:26.390112	f
296	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	945000	2	1.18125e+06	t	2026-01-14 16:11:26.830239	f
297	4371	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.2281e+06	3	2.963373e+06	f	2026-01-14 16:12:36.191991	f
298	4393	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.25e+06	2	1.5625e+06	f	2026-01-14 16:36:53.579639	f
299	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.3125e+06	2	1.640625e+06	t	2026-01-14 16:36:54.046368	f
300	4425	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.5e+06	1	2.5e+06	f	2026-01-14 16:41:57.999236	f
301	4429	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.5e+06	1	1.5e+06	f	2026-01-14 16:43:39.214513	f
302	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.26e+06	2	1.575e+06	t	2026-01-14 16:43:39.677678	f
303	4429	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2e+06	1	2e+06	f	2026-01-14 16:43:55.154508	f
304	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.68e+06	2	2.1e+06	t	2026-01-14 16:43:55.599825	f
305	4436	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.5e+06	2	1.875e+06	f	2026-01-14 16:45:12.144845	f
306	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	750000	3	997500	f	2026-01-14 16:46:41.417767	f
307	4371	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.5e+06	3	3.325e+06	f	2026-01-14 17:06:13.533619	f
308	4393	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.3e+06	2	2.875e+06	f	2026-01-14 17:08:46.494691	f
309	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.415e+06	2	3.01875e+06	f	2026-01-14 17:36:05.375101	f
310	4844	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.75625e+06	3	3.6658125e+06	f	2026-01-14 17:40:17.828836	f
311	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	2.894063e+06	3	3.8491038e+06	t	2026-01-14 17:40:18.263637	f
312	4375	4f229366-dbe3-4361-84cb-115cab42685f	510514	2	638142.5	f	2026-01-14 17:59:09.935248	f
313	4375	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	536040	2	670050	t	2026-01-14 17:59:10.394051	f
314	4375	4f229366-dbe3-4361-84cb-115cab42685f	800000	2	1e+06	f	2026-01-14 17:59:36.795061	f
315	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.090577e+06	1	1.090577e+06	t	2026-01-14 18:13:37.293269	f
316	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.145106e+06	1	1.145106e+06	t	2026-01-14 18:13:37.727348	f
317	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.202362e+06	1	1.202362e+06	t	2026-01-14 18:13:38.118843	f
318	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.262481e+06	1	1.262481e+06	t	2026-01-14 18:13:38.522494	f
319	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.325606e+06	1	1.325606e+06	t	2026-01-14 18:13:38.901561	f
320	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.391887e+06	1	1.391887e+06	t	2026-01-14 18:13:39.27481	f
321	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.461482e+06	1	1.461482e+06	t	2026-01-14 18:13:39.658185	f
322	4389	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-14 18:16:12.827714	f
323	4425	6f591686-4009-4693-a2c7-d3eb1b36073f	2.625e+06	1	2.625e+06	t	2026-01-14 18:35:21.250134	f
324	4375	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1e+06	2	1.25e+06	f	2026-01-14 19:29:03.238866	f
325	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.534557e+06	1	1.534557e+06	t	2026-01-14 19:43:35.047103	f
326	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.611285e+06	1	1.611285e+06	t	2026-01-14 19:43:35.497577	f
327	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.69185e+06	1	1.69185e+06	t	2026-01-14 19:51:59.711008	f
328	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.776443e+06	1	1.776443e+06	t	2026-01-14 19:52:00.156053	f
329	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.865266e+06	1	1.865266e+06	t	2026-01-14 19:52:00.551123	f
330	4374	4f229366-dbe3-4361-84cb-115cab42685f	1.95853e+06	1	1.95853e+06	t	2026-01-14 19:52:00.93629	f
331	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.645166e+06	2	2.0564575e+06	t	2026-01-14 19:59:17.653377	f
332	4374	4f229366-dbe3-4361-84cb-115cab42685f	2.159281e+06	1	2.159281e+06	t	2026-01-14 19:59:18.095888	f
333	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.813797e+06	2	2.2672462e+06	t	2026-01-14 19:59:18.48757	f
334	4374	4f229366-dbe3-4361-84cb-115cab42685f	2.380609e+06	1	2.380609e+06	t	2026-01-14 19:59:18.874435	f
335	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.999712e+06	2	2.49964e+06	t	2026-01-14 19:59:19.260726	f
336	4374	4f229366-dbe3-4361-84cb-115cab42685f	2.624622e+06	1	2.624622e+06	t	2026-01-14 19:59:19.646075	f
337	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.204683e+06	2	2.7558538e+06	t	2026-01-14 20:00:42.490694	f
338	4374	4f229366-dbe3-4361-84cb-115cab42685f	2.893647e+06	1	2.893647e+06	t	2026-01-14 20:00:42.956285	f
339	4374	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.430664e+06	2	3.03833e+06	t	2026-01-14 20:00:43.3615	f
340	4376	cc78d40c-9179-4616-9834-9aa9c69963fa	420000	4	600600	t	2026-01-14 20:29:54.914636	f
341	4393	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3e+06	2	3.75e+06	f	2026-01-14 21:15:55.803242	f
342	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	400000	1	400000	t	2026-01-14 21:20:48.131616	f
343	4425	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3e+06	1	3e+06	f	2026-01-14 21:22:27.220491	f
344	4425	6f591686-4009-4693-a2c7-d3eb1b36073f	3.15e+06	1	3.15e+06	t	2026-01-14 21:22:27.672368	f
345	4425	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4e+06	1	4e+06	f	2026-01-14 21:22:57.957875	f
346	4412	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	8e+06	1	8e+06	f	2026-01-14 21:24:03.719298	f
347	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	6.31579e+06	3	8.400001e+06	t	2026-01-14 21:24:04.180186	f
348	4412	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1e+07	1	1e+07	f	2026-01-14 21:24:31.279009	f
349	4427	6f591686-4009-4693-a2c7-d3eb1b36073f	2.832471e+06	2	3.5405888e+06	t	2026-01-14 21:54:04.148441	f
350	4393	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.15e+06	2	3.9375e+06	f	2026-01-14 21:57:09.611211	f
351	4408	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	737056	1	737056	t	2026-01-14 22:05:50.51133	f
352	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	619128	2	773910	t	2026-01-14 22:05:50.942525	f
353	4408	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	812606	1	812606	t	2026-01-14 22:05:51.311987	f
354	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	682590	2	853237.5	t	2026-01-14 22:05:51.694117	f
355	4408	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	895900	1	895900	t	2026-01-14 22:05:52.08546	f
356	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	752556	2	940695	t	2026-01-14 22:05:52.457279	f
357	4408	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	987730	1	987730	t	2026-01-14 22:05:52.821432	f
358	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	829694	2	1.0371175e+06	t	2026-01-14 22:05:53.192007	f
359	4394	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.2e+07	2	1.5e+07	f	2026-01-14 22:10:14.714036	f
360	4402	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	1	400000	t	2026-01-14 22:17:51.25768	f
361	4394	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	1.1538462e+07	4	1.6500001e+07	f	2026-01-14 23:30:19.161457	f
362	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	7.894737e+06	3	1.05e+07	t	2026-01-14 23:39:10.562974	f
363	4378	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	400000	1	400000	f	2026-01-15 00:03:20.603513	f
364	4390	51f792dc-04f3-467f-a604-631165c75b38	8.82e+06	1	8.82e+06	t	2026-01-15 01:24:17.685069	f
365	4390	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	9.261e+06	1	9.261e+06	t	2026-01-15 01:24:18.112654	f
366	4390	51f792dc-04f3-467f-a604-631165c75b38	9.72405e+06	1	9.72405e+06	t	2026-01-15 01:25:00.052304	f
367	4390	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.0210253e+07	1	1.0210253e+07	t	2026-01-15 01:25:00.489395	f
368	4429	51f792dc-04f3-467f-a604-631165c75b38	2.205e+06	1	2.205e+06	t	2026-01-15 01:34:08.853153	f
369	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.8522e+06	2	2.31525e+06	t	2026-01-15 01:34:09.283095	f
370	4429	51f792dc-04f3-467f-a604-631165c75b38	2.431013e+06	1	2.431013e+06	t	2026-01-15 01:34:09.660723	f
371	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.042051e+06	2	2.5525638e+06	t	2026-01-15 01:34:10.034384	f
372	4429	51f792dc-04f3-467f-a604-631165c75b38	2.680192e+06	1	2.680192e+06	t	2026-01-15 01:34:10.406834	f
373	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.251362e+06	2	2.8142025e+06	t	2026-01-15 01:34:10.805481	f
374	4429	51f792dc-04f3-467f-a604-631165c75b38	2.954913e+06	1	2.954913e+06	t	2026-01-15 01:34:11.181456	f
375	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.482127e+06	2	3.1026588e+06	t	2026-01-15 01:34:11.573915	f
376	4425	51f792dc-04f3-467f-a604-631165c75b38	4.2e+06	1	4.2e+06	t	2026-01-15 01:34:44.656426	f
377	4364	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	558600	1	558600	t	2026-01-15 01:55:15.559589	f
378	4375	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.3125e+06	1	1.3125e+06	t	2026-01-15 01:56:14.512521	f
379	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	400000	1	400000	t	2026-01-15 02:02:31.528306	f
380	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.974095e+06	2	3.7176188e+06	t	2026-01-15 02:06:56.127858	f
381	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.9035e+06	1	3.9035e+06	f	2026-01-15 02:23:31.653425	f
382	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.27894e+06	2	4.098675e+06	t	2026-01-15 02:23:32.099893	f
383	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.303609e+06	1	4.303609e+06	f	2026-01-15 02:23:40.690724	f
384	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.615032e+06	2	4.51879e+06	t	2026-01-15 02:23:41.124765	f
385	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.795784e+06	2	4.74473e+06	t	2026-01-15 02:24:02.44282	f
386	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.985574e+06	2	4.9819675e+06	t	2026-01-15 02:24:02.865588	f
387	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.184853e+06	2	5.231066e+06	t	2026-01-15 02:24:03.236172	f
388	4427	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	4.394096e+06	2	5.49262e+06	t	2026-01-15 02:24:03.653772	f
389	4427	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.613801e+06	2	5.767251e+06	t	2026-01-15 02:24:04.025268	f
390	4394	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.3026317e+07	3	1.7325002e+07	t	2026-01-15 02:29:04.135263	f
391	4398	c532b6f7-bdfb-4505-b43f-f653770c03af	400000	1	400000	f	2026-01-15 02:29:05.022128	f
392	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.088974e+06	1	1.088974e+06	t	2026-01-15 04:21:19.774874	f
393	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	914739	2	1.1434238e+06	t	2026-01-15 04:21:20.222788	f
394	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.200595e+06	1	1.200595e+06	t	2026-01-15 04:21:20.609113	f
395	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.0085e+06	2	1.260625e+06	t	2026-01-15 04:21:21.011647	f
396	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.323657e+06	1	1.323657e+06	t	2026-01-15 04:21:21.412443	f
397	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.111872e+06	2	1.38984e+06	t	2026-01-15 04:21:21.800905	f
398	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.459332e+06	1	1.459332e+06	t	2026-01-15 04:21:22.208601	f
399	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.225839e+06	2	1.5322988e+06	t	2026-01-15 04:21:22.599442	f
400	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.287131e+06	2	1.6089138e+06	t	2026-01-15 04:22:28.111362	f
401	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.351488e+06	2	1.68936e+06	t	2026-01-15 04:22:28.598913	f
402	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.419063e+06	2	1.7738288e+06	t	2026-01-15 04:22:29.008385	f
403	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.490017e+06	2	1.8625212e+06	t	2026-01-15 04:22:29.399999	f
404	4408	388f55c3-52e1-499f-8a56-948636a8c205	1.564518e+06	2	1.9556475e+06	t	2026-01-15 04:23:00.752593	f
405	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.642744e+06	2	2.05343e+06	t	2026-01-15 04:23:01.228667	f
406	4410	0477609b-080d-4cd2-b891-117e615bdf47	400000	2	500000	f	2026-01-15 13:07:17.291948	f
407	4408	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	3e+06	1	3e+06	f	2026-01-15 13:48:34.251958	f
408	4402	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	500000	1	500000	f	2026-01-15 13:49:22.493755	f
409	4402	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	525000	1	525000	t	2026-01-15 13:49:22.922226	f
410	4402	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	750000	1	750000	f	2026-01-15 13:49:41.318776	f
411	4425	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5e+06	1	5e+06	f	2026-01-15 14:18:27.777669	f
412	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	t	2026-01-15 14:30:45.365243	f
413	4492	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	1	400000	f	2026-01-15 14:42:38.429578	f
414	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.038767e+06	3	4.04156e+06	t	2026-01-15 15:17:22.265473	f
415	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	3.190706e+06	3	4.243639e+06	t	2026-01-15 15:17:22.694289	f
416	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.350242e+06	3	4.455822e+06	t	2026-01-15 15:17:23.062502	f
417	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	3.517755e+06	3	4.678614e+06	t	2026-01-15 15:17:23.449312	f
418	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.693643e+06	3	4.912545e+06	t	2026-01-15 15:17:23.816078	f
419	4844	6f591686-4009-4693-a2c7-d3eb1b36073f	3.878325e+06	3	5.158172e+06	t	2026-01-15 15:17:24.174224	f
420	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	4.072242e+06	3	5.416082e+06	t	2026-01-15 15:18:25.216263	f
421	4412	cc78d40c-9179-4616-9834-9aa9c69963fa	8.289474e+06	3	1.1025e+07	t	2026-01-15 15:28:04.749992	f
422	4424	4f229366-dbe3-4361-84cb-115cab42685f	525000	1	525000	t	2026-01-15 18:36:53.176445	f
423	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	441000	2	551250	t	2026-01-15 18:36:53.666279	f
424	4424	4f229366-dbe3-4361-84cb-115cab42685f	578813	1	578813	t	2026-01-15 18:36:54.03677	f
425	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	486203	2	607753.75	t	2026-01-15 18:36:54.403062	f
426	4424	4f229366-dbe3-4361-84cb-115cab42685f	638142	1	638142	t	2026-01-15 18:36:54.766958	f
427	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	536040	2	670050	t	2026-01-15 18:36:55.16765	f
428	4424	4f229366-dbe3-4361-84cb-115cab42685f	703553	1	703553	t	2026-01-15 18:36:55.527898	f
429	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	590985	2	738731.25	t	2026-01-15 18:36:55.895997	f
430	4424	4f229366-dbe3-4361-84cb-115cab42685f	775668	1	775668	t	2026-01-15 18:36:56.262124	f
431	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	651562	2	814452.5	t	2026-01-15 18:36:56.613263	f
432	4424	4f229366-dbe3-4361-84cb-115cab42685f	855176	1	855176	t	2026-01-15 18:36:56.997037	f
433	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	718348	2	897935	t	2026-01-15 18:36:57.377813	f
434	4424	4f229366-dbe3-4361-84cb-115cab42685f	942832	1	942832	t	2026-01-15 18:36:57.729444	f
435	4424	17faf686-27d1-4e30-a11c-4e7ec21ca685	791979	2	989973.75	t	2026-01-15 18:36:58.093727	f
436	4410	4f229366-dbe3-4361-84cb-115cab42685f	1.5e+06	1	1.5e+06	f	2026-01-15 18:46:21.70518	f
437	4428	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-15 18:50:53.186813	f
438	4418	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-15 18:51:43.410338	f
439	4475	4f229366-dbe3-4361-84cb-115cab42685f	586191	1	586191	f	2026-01-15 18:54:16.059875	f
440	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.73034e+06	2	3.412925e+06	f	2026-01-15 19:25:05.190786	f
441	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.866857e+06	2	3.5835712e+06	t	2026-01-15 19:25:05.636468	f
442	4429	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.153543e+06	2	3.9419288e+06	f	2026-01-15 19:25:19.377803	f
443	4429	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.311221e+06	2	4.1390262e+06	t	2026-01-15 19:25:19.785785	f
444	4431	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.318275e+06	1	1.318275e+06	f	2026-01-15 19:26:35.909324	f
445	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	440000	2	550000	f	2026-01-15 19:30:59.379757	f
446	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	462000	2	577500	t	2026-01-15 19:30:59.793799	f
447	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	485100	2	606375	f	2026-01-15 19:31:07.760534	f
448	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	509355	2	636693.75	t	2026-01-15 19:31:08.17158	f
449	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	534823	2	668528.75	f	2026-01-15 19:31:17.354466	f
450	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	561565	2	701956.25	t	2026-01-15 19:31:17.777807	f
451	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	589644	2	737055	f	2026-01-15 19:31:24.168068	f
452	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	619127	2	773908.75	t	2026-01-15 19:31:24.589792	f
453	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	800000	2	1e+06	f	2026-01-15 19:31:37.400902	f
454	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	840000	2	1.05e+06	t	2026-01-15 19:31:37.812768	f
455	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.2e+06	2	1.5e+06	f	2026-01-15 19:31:56.510692	f
456	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	615501	1	615501	f	2026-01-15 21:15:39.711383	f
457	4410	0477609b-080d-4cd2-b891-117e615bdf47	1.184211e+06	3	1.5750006e+06	f	2026-01-15 23:43:13.129695	f
458	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.184211e+06	3	1.5750006e+06	t	2026-01-16 00:16:47.802205	f
459	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	1	420000	t	2026-01-16 01:39:54.472512	f
460	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	441000	1	441000	t	2026-01-16 01:39:54.892522	f
461	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	463050	1	463050	t	2026-01-16 01:39:55.256522	f
462	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	486203	1	486203	t	2026-01-16 01:39:55.621713	f
463	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	510514	1	510514	t	2026-01-16 01:39:55.984987	f
464	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	536040	1	536040	t	2026-01-16 01:39:56.338807	f
465	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	562842	1	562842	t	2026-01-16 01:39:56.692738	f
466	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	590985	1	590985	t	2026-01-16 01:39:57.045984	f
467	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	620535	1	620535	t	2026-01-16 01:56:37.962604	f
468	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	651562	1	651562	t	2026-01-16 01:56:38.377136	f
469	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	684141	1	684141	t	2026-01-16 01:56:38.734164	f
470	4401	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	718349	1	718349	t	2026-01-16 01:56:39.095395	f
471	4401	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	754267	1	754267	t	2026-01-16 01:56:39.454172	f
472	4496	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	400000	1	400000	t	2026-01-16 01:56:54.713741	f
473	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	8.703948e+06	3	1.1576251e+07	t	2026-01-16 01:58:58.111111	f
474	4412	cc78d40c-9179-4616-9834-9aa9c69963fa	9.139146e+06	3	1.2155064e+07	t	2026-01-16 01:58:58.517875	f
475	4412	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	9.596104e+06	3	1.2762818e+07	t	2026-01-16 02:02:55.901092	f
476	4412	cc78d40c-9179-4616-9834-9aa9c69963fa	1.0075909e+07	3	1.3400959e+07	t	2026-01-16 02:02:56.306076	f
477	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.52e+06	2	3.15e+06	t	2026-01-16 02:04:50.366837	f
478	4408	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.646e+06	2	3.3075e+06	f	2026-01-16 02:08:06.257034	f
479	4408	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.7783e+06	2	3.472875e+06	t	2026-01-16 02:08:06.672241	f
480	4427	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4.844491e+06	2	6.055614e+06	t	2026-01-16 02:29:04.975183	f
481	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.848417e+06	1	1.848417e+06	f	2026-01-16 02:56:06.91578	f
482	4435	51f792dc-04f3-467f-a604-631165c75b38	675726	5	1.0473753e+06	t	2026-01-16 03:09:10.743198	f
483	4447	51f792dc-04f3-467f-a604-631165c75b38	5.529954e+06	1	5.529954e+06	t	2026-01-16 03:13:15.287655	f
484	4499	51f792dc-04f3-467f-a604-631165c75b38	2.161e+06	1	2.161e+06	t	2026-01-16 03:17:08.045961	f
485	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.26905e+06	1	2.26905e+06	t	2026-01-16 03:17:08.457294	f
486	4499	51f792dc-04f3-467f-a604-631165c75b38	2.382503e+06	1	2.382503e+06	t	2026-01-16 03:17:08.819637	f
487	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.501629e+06	1	2.501629e+06	t	2026-01-16 03:17:09.175283	f
488	4499	51f792dc-04f3-467f-a604-631165c75b38	2.626711e+06	1	2.626711e+06	t	2026-01-16 03:17:09.53213	f
489	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.758047e+06	1	2.758047e+06	t	2026-01-16 03:17:09.908799	f
490	4499	51f792dc-04f3-467f-a604-631165c75b38	2.89595e+06	1	2.89595e+06	t	2026-01-16 03:17:10.275346	f
491	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.040748e+06	1	3.040748e+06	t	2026-01-16 03:17:10.653335	f
492	4499	51f792dc-04f3-467f-a604-631165c75b38	3.192786e+06	1	3.192786e+06	t	2026-01-16 03:17:11.018658	f
493	4499	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.352426e+06	1	3.352426e+06	t	2026-01-16 03:17:11.379922	f
494	4499	51f792dc-04f3-467f-a604-631165c75b38	3.520048e+06	1	3.520048e+06	t	2026-01-16 03:17:11.743762	f
495	4458	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.5e+06	2	6.875e+06	f	2026-01-16 12:23:54.013771	f
496	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	500000	2	625000	t	2026-01-16 14:01:37.597402	f
497	4526	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	1e+06	1	1e+06	f	2026-01-16 14:40:06.387537	f
498	4436	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.96875e+06	1	1.96875e+06	f	2026-01-16 15:07:35.186508	f
499	4462	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.653751e+06	1	1.653751e+06	f	2026-01-16 15:08:40.040639	f
500	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	5.529954e+06	2	6.9124425e+06	t	2026-01-16 15:19:44.1656	f
501	4437	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.6520056e+07	2	2.065007e+07	f	2026-01-16 17:20:13.302974	f
502	4520	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.229984e+06	1	5.229984e+06	f	2026-01-16 18:25:55.752202	f
503	4437	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.734606e+07	2	2.1682574e+07	t	2026-01-16 19:43:17.650505	f
504	4436	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.444144e+06	1	2.444144e+06	f	2026-01-16 19:44:05.243253	f
505	4453	889cd08b-6e70-4f4c-847f-363dbbe2c110	400000	1	400000	t	2026-01-16 19:45:08.783561	f
506	4462	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.389151e+06	2	1.7364388e+06	t	2026-01-16 19:45:37.779577	f
507	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.956841e+06	2	3.6960512e+06	t	2026-01-16 19:47:35.927637	f
508	4499	51f792dc-04f3-467f-a604-631165c75b38	3.880854e+06	1	3.880854e+06	t	2026-01-16 19:47:36.3414	f
509	4497	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.940838e+06	1	1.940838e+06	t	2026-01-16 19:48:18.459833	f
510	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.848417e+06	2	2.3105212e+06	t	2026-01-16 19:48:18.87057	f
511	4497	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.426048e+06	1	2.426048e+06	t	2026-01-16 19:48:19.230573	f
512	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.037881e+06	2	2.5473512e+06	t	2026-01-16 19:48:19.587088	f
513	4497	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.674719e+06	1	2.674719e+06	t	2026-01-16 19:48:19.951471	f
514	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.246764e+06	2	2.808455e+06	t	2026-01-16 19:48:20.306006	f
515	4437	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.8213364e+07	2	2.2766704e+07	f	2026-01-16 20:26:16.808396	f
516	4437	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.9124032e+07	2	2.390504e+07	t	2026-01-16 20:26:17.322394	f
517	4447	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.806452e+06	2	7.258065e+06	f	2026-01-16 20:42:31.217812	f
518	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	6.096775e+06	2	7.620969e+06	t	2026-01-16 20:42:31.637754	f
519	4447	5d77ac22-c768-4d3b-99d8-73c250a3e859	6.401614e+06	2	8.0020175e+06	f	2026-01-16 20:43:13.380391	f
520	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	6.721695e+06	2	8.402119e+06	t	2026-01-16 20:43:13.794676	f
521	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.458609e+06	2	1.8232612e+06	t	2026-01-16 21:22:05.684078	f
522	4462	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.53154e+06	2	1.914425e+06	t	2026-01-16 21:22:06.106198	f
523	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.608117e+06	2	2.0101462e+06	t	2026-01-16 21:23:01.855464	f
524	4462	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.688523e+06	2	2.1106538e+06	t	2026-01-16 21:23:02.275108	f
525	4467	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	400000	3	532000	f	2026-01-16 22:09:52.58366	f
526	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	558600	1	558600	t	2026-01-16 22:09:53.019524	f
527	4467	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	441000	3	586530	f	2026-01-16 22:10:36.456069	f
528	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	615857	1	615857	t	2026-01-16 22:10:36.86776	f
529	4467	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	486203	3	646650	f	2026-01-16 22:11:09.742217	f
530	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	678983	1	678983	t	2026-01-16 22:11:10.137288	f
531	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	646277	1	646277	f	2026-01-16 22:30:54.2249	f
532	4462	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.666306e+06	3	2.216187e+06	t	2026-01-16 22:32:45.608261	f
533	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.627271e+06	4	2.3269975e+06	t	2026-01-16 22:34:36.748975	f
534	4436	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.053081e+06	2	2.5663512e+06	t	2026-01-16 22:36:45.711863	f
535	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	769052	4	1.0997444e+06	t	2026-01-16 22:38:42.158813	f
536	4435	51f792dc-04f3-467f-a604-631165c75b38	744989	5	1.154733e+06	t	2026-01-16 22:38:42.582026	f
537	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	847881	4	1.2124699e+06	t	2026-01-16 22:38:42.95686	f
538	4435	51f792dc-04f3-467f-a604-631165c75b38	821351	5	1.273094e+06	t	2026-01-16 22:38:43.320153	f
539	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	934790	4	1.3367498e+06	t	2026-01-16 22:38:43.690032	f
540	4435	51f792dc-04f3-467f-a604-631165c75b38	905541	5	1.4035885e+06	t	2026-01-16 22:38:44.062609	f
541	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.030607e+06	4	1.473768e+06	t	2026-01-16 22:38:44.444817	f
542	4435	51f792dc-04f3-467f-a604-631165c75b38	998359	5	1.5474565e+06	t	2026-01-16 22:38:44.8115	f
543	4435	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.555555e+06	5	2.4111102e+06	f	2026-01-16 22:41:17.31537	f
544	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	586191	2	732738.75	t	2026-01-16 22:44:34.992509	f
545	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	769376	1	769376	t	2026-01-16 22:44:35.405527	f
546	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	646276	2	807845	t	2026-01-16 22:44:35.760277	f
547	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	848238	1	848238	t	2026-01-16 22:44:36.147323	f
548	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	712520	2	890650	t	2026-01-16 22:44:36.508244	f
549	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	935183	1	935183	t	2026-01-16 22:44:36.867305	f
550	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	785554	2	981942.5	t	2026-01-16 22:44:37.248297	f
551	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.063833e+06	3	4.074898e+06	t	2026-01-16 22:47:34.982142	f
552	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.217202e+06	3	2.9488788e+06	t	2026-01-16 22:48:13.497151	f
553	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	400000	3	532000	t	2026-01-16 22:50:12.831469	f
554	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.477059e+06	2	3.0963238e+06	f	2026-01-16 22:53:30.473888	f
555	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.444467e+06	3	3.251141e+06	t	2026-01-16 22:53:30.891665	f
556	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.03104e+06	1	1.03104e+06	f	2026-01-16 22:54:17.824746	f
557	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	866074	2	1.0825925e+06	t	2026-01-16 22:54:18.242741	f
558	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	420000	1	420000	t	2026-01-16 23:17:03.285936	f
559	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	441000	1	441000	t	2026-01-16 23:17:03.730098	f
560	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	463050	1	463050	t	2026-01-16 23:17:04.150162	f
561	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	486203	1	486203	t	2026-01-16 23:17:04.539052	f
562	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	510514	1	510514	t	2026-01-16 23:17:04.925717	f
563	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	536040	1	536040	t	2026-01-16 23:17:05.316228	f
564	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	562842	1	562842	t	2026-01-16 23:17:05.697919	f
565	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	590985	1	590985	t	2026-01-16 23:17:06.083539	f
566	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	620535	1	620535	t	2026-01-16 23:17:06.476461	f
567	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	651562	1	651562	t	2026-01-16 23:17:06.863642	f
568	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	684141	1	684141	t	2026-01-16 23:17:07.267382	f
569	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	718349	1	718349	t	2026-01-16 23:17:07.665913	f
570	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	754267	1	754267	t	2026-01-16 23:17:08.065686	f
571	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	791981	1	791981	t	2026-01-16 23:17:08.455824	f
572	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	831581	1	831581	t	2026-01-16 23:17:08.846843	f
573	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	873161	1	873161	t	2026-01-16 23:17:09.258935	f
574	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	916820	1	916820	t	2026-01-16 23:17:09.654015	f
575	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	962661	1	962661	t	2026-01-16 23:17:10.041937	f
576	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.010795e+06	1	1.010795e+06	t	2026-01-16 23:17:10.434413	f
577	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.061335e+06	1	1.061335e+06	t	2026-01-16 23:17:10.816853	f
578	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.114402e+06	1	1.114402e+06	t	2026-01-16 23:17:30.340952	f
579	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.170123e+06	1	1.170123e+06	t	2026-01-16 23:17:30.754021	f
580	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.22863e+06	1	1.22863e+06	t	2026-01-16 23:17:31.108597	f
581	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.290062e+06	1	1.290062e+06	t	2026-01-16 23:17:31.49233	f
582	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.354566e+06	1	1.354566e+06	t	2026-01-16 23:17:31.911715	f
583	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.422295e+06	1	1.422295e+06	t	2026-01-16 23:17:32.317382	f
584	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.49341e+06	1	1.49341e+06	t	2026-01-16 23:17:32.683361	f
585	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.568081e+06	1	1.568081e+06	t	2026-01-16 23:17:33.039131	f
586	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.646486e+06	1	1.646486e+06	t	2026-01-16 23:17:33.395572	f
587	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.728811e+06	1	1.728811e+06	t	2026-01-16 23:17:33.769617	f
588	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.452202e+06	2	1.8152525e+06	t	2026-01-16 23:17:56.868379	f
589	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.906016e+06	1	1.906016e+06	t	2026-01-16 23:17:57.264615	f
590	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.601054e+06	2	2.0013175e+06	t	2026-01-16 23:17:57.634075	f
591	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.101384e+06	1	2.101384e+06	t	2026-01-16 23:17:57.997949	f
592	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	420000	3	558600	t	2026-01-16 23:59:40.873266	f
593	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	441000	3	586530	t	2026-01-16 23:59:41.288964	f
594	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	463050	3	615856.5	t	2026-01-16 23:59:41.645758	f
595	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	486203	3	646650	t	2026-01-16 23:59:42.008909	f
596	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	510514	3	678983.6	t	2026-01-16 23:59:42.371467	f
597	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	536040	3	712933.2	t	2026-01-16 23:59:42.747846	f
598	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	562842	3	748579.9	t	2026-01-17 00:05:42.135235	f
599	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	590985	3	786010.06	t	2026-01-17 00:05:42.567547	f
600	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	620535	3	825311.56	t	2026-01-17 00:05:42.928056	f
601	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	651562	3	866577.44	t	2026-01-17 00:05:43.296195	f
602	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	684141	3	909907.5	t	2026-01-17 00:05:43.659259	f
603	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	718349	3	955404.2	t	2026-01-17 00:05:44.022468	f
604	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	754267	3	1.0031751e+06	t	2026-01-17 00:05:44.634723	f
605	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	791981	3	1.0533348e+06	t	2026-01-17 00:05:45.016642	f
606	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	831581	3	1.1060028e+06	t	2026-01-17 00:05:45.395196	f
607	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	873161	3	1.1613041e+06	t	2026-01-17 00:05:45.757927	f
608	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	916820	3	1.2193706e+06	t	2026-01-17 00:05:46.148325	f
609	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	962661	3	1.2803391e+06	t	2026-01-17 00:05:46.510067	f
610	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.010795e+06	3	1.3443574e+06	t	2026-01-17 00:05:46.874494	f
611	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.061335e+06	3	1.4115755e+06	t	2026-01-17 00:05:47.246751	f
612	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.114402e+06	3	1.4821546e+06	t	2026-01-17 00:05:47.627046	f
613	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.170123e+06	3	1.5562636e+06	t	2026-01-17 00:05:47.99074	f
614	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.22863e+06	3	1.6340779e+06	t	2026-01-17 00:05:48.355793	f
615	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.290062e+06	3	1.7157825e+06	t	2026-01-17 00:05:48.761276	f
616	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.354566e+06	3	1.8015728e+06	t	2026-01-17 00:06:30.197935	f
617	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.422295e+06	3	1.8916524e+06	t	2026-01-17 00:06:30.617485	f
618	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.49341e+06	3	1.9862352e+06	t	2026-01-17 00:06:30.987706	f
619	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.568081e+06	3	2.0855478e+06	t	2026-01-17 00:06:31.362928	f
620	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.646486e+06	3	2.1898265e+06	t	2026-01-17 00:06:31.752886	f
621	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.728811e+06	3	2.2993188e+06	t	2026-01-17 00:06:32.11639	f
622	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.815252e+06	3	2.4142852e+06	t	2026-01-17 00:06:32.477578	f
623	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.906015e+06	3	2.535e+06	t	2026-01-17 00:06:32.861537	f
624	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.001316e+06	3	2.6617502e+06	t	2026-01-17 00:06:33.223958	f
625	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.101382e+06	3	2.794838e+06	t	2026-01-17 00:06:33.615135	f
626	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.206452e+06	3	2.9345812e+06	t	2026-01-17 00:06:33.99369	f
627	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.316775e+06	3	3.0813108e+06	t	2026-01-17 00:06:34.382821	f
628	4513	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.432614e+06	3	3.2353765e+06	t	2026-01-17 00:06:34.7672	f
629	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.554245e+06	3	3.3971458e+06	t	2026-01-17 00:06:35.160463	f
630	4509	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.307603e+06	1	3.307603e+06	f	2026-01-17 00:25:44.172575	f
631	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.136723e+06	1	1.136723e+06	t	2026-01-17 00:29:53.72243	f
632	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	954848	2	1.19356e+06	t	2026-01-17 00:29:54.143825	f
633	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.253238e+06	1	1.253238e+06	t	2026-01-17 00:29:54.511521	f
634	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.05272e+06	2	1.3159e+06	t	2026-01-17 00:29:54.870142	f
635	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.381695e+06	1	1.381695e+06	t	2026-01-17 00:29:55.233893	f
636	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.160624e+06	2	1.45078e+06	t	2026-01-17 00:29:55.595763	f
637	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.523319e+06	1	1.523319e+06	t	2026-01-17 00:29:55.956908	f
638	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.279588e+06	2	1.599485e+06	t	2026-01-17 00:29:56.312366	f
639	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.67946e+06	1	1.67946e+06	t	2026-01-17 00:29:56.672062	f
640	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.410747e+06	2	1.7634338e+06	t	2026-01-17 00:29:57.030483	f
641	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	1.851606e+06	1	1.851606e+06	t	2026-01-17 00:29:57.427519	f
642	4475	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.55535e+06	2	1.9441875e+06	t	2026-01-17 00:29:57.798774	f
643	4513	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	4e+06	4	5.72e+06	f	2026-01-17 00:34:38.609594	f
644	4447	6f591686-4009-4693-a2c7-d3eb1b36073f	7.05778e+06	2	8.822225e+06	f	2026-01-17 01:00:28.252769	f
645	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	7.410669e+06	2	9.263336e+06	t	2026-01-17 01:00:28.691099	f
646	4447	6f591686-4009-4693-a2c7-d3eb1b36073f	7.31316e+06	3	9.726503e+06	f	2026-01-17 01:01:52.345377	f
647	4436	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.694669e+06	1	2.694669e+06	f	2026-01-17 01:32:10.5597	f
648	4436	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.263522e+06	2	2.8294025e+06	t	2026-01-17 01:32:11.128586	f
649	4462	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.443348e+06	1	2.443348e+06	f	2026-01-17 01:32:41.490302	f
650	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.794067e+06	4	2.5655158e+06	t	2026-01-17 01:32:41.901798	f
651	4455	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	630000	1	630000	f	2026-01-17 01:35:04.586425	f
652	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	712933	1	712933	t	2026-01-17 01:37:42.706792	f
653	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	748580	1	748580	t	2026-01-17 01:37:43.124051	f
654	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	786009	1	786009	t	2026-01-17 01:37:43.503886	f
655	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	825310	1	825310	t	2026-01-17 01:37:43.857313	f
656	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	866576	1	866576	t	2026-01-17 01:37:44.234942	f
657	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	909905	1	909905	t	2026-01-17 01:37:44.594586	f
658	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	955401	1	955401	t	2026-01-17 01:38:24.525574	f
659	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.003172e+06	1	1.003172e+06	t	2026-01-17 01:38:24.967273	f
660	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.053331e+06	1	1.053331e+06	t	2026-01-17 01:39:07.170905	f
661	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.105998e+06	1	1.105998e+06	t	2026-01-17 01:39:07.592333	f
662	4467	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.161298e+06	1	1.161298e+06	t	2026-01-17 01:39:07.96285	f
663	4467	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.219363e+06	1	1.219363e+06	t	2026-01-17 01:39:08.331227	f
664	4455	5d77ac22-c768-4d3b-99d8-73c250a3e859	529200	2	661500	f	2026-01-17 01:53:27.874264	f
665	4447	cc78d40c-9179-4616-9834-9aa9c69963fa	7.678819e+06	3	1.0212829e+07	t	2026-01-17 02:07:14.510622	f
666	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.025408e+06	3	2.6937928e+06	t	2026-01-17 02:25:50.234333	f
667	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.97796e+06	4	2.8284828e+06	t	2026-01-17 02:25:50.649931	f
668	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.233013e+06	3	2.9699072e+06	t	2026-01-17 02:25:51.015092	f
669	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.180702e+06	4	3.1184038e+06	t	2026-01-17 02:25:51.375036	f
670	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.461898e+06	3	3.2743242e+06	t	2026-01-17 02:25:51.73332	f
671	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.404225e+06	4	3.4380418e+06	t	2026-01-17 02:25:52.093568	f
672	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.714244e+06	3	3.6099445e+06	f	2026-01-17 02:26:01.923196	f
673	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.650659e+06	4	3.7904422e+06	t	2026-01-17 02:26:02.356004	f
674	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.5e+06	3	4.655e+06	f	2026-01-17 02:26:40.287521	f
675	4462	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.418007e+06	4	4.88775e+06	t	2026-01-17 02:26:40.713923	f
676	4462	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.85875e+06	3	5.1321375e+06	f	2026-01-17 02:27:36.713016	f
677	4844	51f792dc-04f3-467f-a604-631165c75b38	4.275855e+06	3	5.686887e+06	t	2026-01-17 03:19:30.462419	f
678	4844	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	4.489648e+06	3	5.971232e+06	t	2026-01-17 03:19:30.907909	f
679	4844	51f792dc-04f3-467f-a604-631165c75b38	4.714131e+06	3	6.269794e+06	t	2026-01-17 03:19:31.64742	f
680	4484	51f792dc-04f3-467f-a604-631165c75b38	2.952433e+06	1	2.952433e+06	t	2026-01-17 03:20:39.088802	f
681	4507	51f792dc-04f3-467f-a604-631165c75b38	656250	1	656250	t	2026-01-17 03:22:08.186016	f
682	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	551250	2	689062.5	t	2026-01-17 03:22:08.615933	f
683	4507	51f792dc-04f3-467f-a604-631165c75b38	723516	1	723516	t	2026-01-17 03:22:08.986443	f
684	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	607754	2	759692.5	t	2026-01-17 03:22:09.366893	f
685	4507	51f792dc-04f3-467f-a604-631165c75b38	797678	1	797678	t	2026-01-17 03:22:09.735454	f
686	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	670050	2	837562.5	t	2026-01-17 03:22:10.105481	f
687	4507	51f792dc-04f3-467f-a604-631165c75b38	879441	1	879441	t	2026-01-17 03:22:10.491578	f
688	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	738731	2	923413.75	t	2026-01-17 03:22:10.865392	f
689	4507	51f792dc-04f3-467f-a604-631165c75b38	969585	1	969585	t	2026-01-17 03:22:11.24201	f
690	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	814452	2	1.018065e+06	t	2026-01-17 03:22:11.614384	f
691	4507	51f792dc-04f3-467f-a604-631165c75b38	1.068969e+06	1	1.068969e+06	t	2026-01-17 03:22:11.981645	f
692	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	897934	2	1.1224175e+06	t	2026-01-17 03:22:12.363998	f
693	4507	51f792dc-04f3-467f-a604-631165c75b38	1.178539e+06	1	1.178539e+06	t	2026-01-17 03:22:12.751064	f
694	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	989973	2	1.2374662e+06	t	2026-01-17 03:22:13.124263	f
695	4507	51f792dc-04f3-467f-a604-631165c75b38	1.29934e+06	1	1.29934e+06	t	2026-01-17 03:22:13.50354	f
696	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.091446e+06	2	1.3643075e+06	t	2026-01-17 03:22:13.869159	f
697	4507	51f792dc-04f3-467f-a604-631165c75b38	1.432523e+06	1	1.432523e+06	t	2026-01-17 03:22:14.241885	f
698	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.20332e+06	2	1.50415e+06	t	2026-01-17 03:22:14.612278	f
699	4507	51f792dc-04f3-467f-a604-631165c75b38	1.579358e+06	1	1.579358e+06	t	2026-01-17 03:22:14.974776	f
700	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.326661e+06	2	1.6583262e+06	t	2026-01-17 03:22:15.336145	f
701	4507	51f792dc-04f3-467f-a604-631165c75b38	1.741243e+06	1	1.741243e+06	t	2026-01-17 03:22:15.69621	f
702	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.462645e+06	2	1.8283062e+06	t	2026-01-17 03:22:16.062504	f
703	4507	51f792dc-04f3-467f-a604-631165c75b38	1.919722e+06	1	1.919722e+06	t	2026-01-17 03:22:16.428722	f
704	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.612567e+06	2	2.0157088e+06	t	2026-01-17 03:22:16.811451	f
705	4520	51f792dc-04f3-467f-a604-631165c75b38	5.229984e+06	2	6.53748e+06	t	2026-01-17 03:23:24.361941	f
706	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.206454e+06	1	2.206454e+06	t	2026-01-17 03:24:22.862419	f
707	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.413699e+06	1	3.413699e+06	f	2026-01-17 03:25:19.074401	f
708	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.695026e+06	3	3.5843845e+06	t	2026-01-17 03:25:19.513177	f
709	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.010883e+06	2	3.7636038e+06	f	2026-01-17 03:25:40.651172	f
710	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.971267e+06	3	3.951785e+06	t	2026-01-17 03:25:41.097927	f
711	4475	51f792dc-04f3-467f-a604-631165c75b38	2.041397e+06	1	2.041397e+06	t	2026-01-17 03:27:17.442389	f
712	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.3195e+06	2	4.149375e+06	f	2026-01-17 03:39:04.888108	f
713	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.275823e+06	3	4.3568445e+06	t	2026-01-17 03:39:05.301223	f
714	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.65975e+06	2	4.5746875e+06	f	2026-01-17 03:40:00.01475	f
715	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.611596e+06	3	4.8034225e+06	t	2026-01-17 03:40:00.427578	f
716	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.034875e+06	2	5.043594e+06	f	2026-01-17 03:40:26.881841	f
717	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.981785e+06	3	5.295774e+06	t	2026-01-17 03:40:27.31001	f
718	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.143467e+06	1	2.143467e+06	f	2026-01-17 04:19:32.35782	f
719	4475	51f792dc-04f3-467f-a604-631165c75b38	2.250641e+06	1	2.250641e+06	t	2026-01-17 04:19:32.770169	f
720	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.422915e+06	2	4.278644e+06	f	2026-01-17 04:20:23.661288	f
721	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.377877e+06	3	4.4925765e+06	t	2026-01-17 04:20:24.074815	f
722	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.773765e+06	2	4.717206e+06	f	2026-01-17 04:20:51.711504	f
723	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.72411e+06	3	4.9530665e+06	t	2026-01-17 04:20:52.151353	f
724	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.890539e+06	2	2.3631738e+06	f	2026-01-17 04:21:24.229636	f
725	4475	51f792dc-04f3-467f-a604-631165c75b38	2.481333e+06	1	2.481333e+06	t	2026-01-17 04:21:24.654663	f
726	4475	4f229366-dbe3-4361-84cb-115cab42685f	2.6054e+06	1	2.6054e+06	t	2026-01-17 05:27:40.057142	f
727	4475	51f792dc-04f3-467f-a604-631165c75b38	2.73567e+06	1	2.73567e+06	t	2026-01-17 05:27:40.502372	f
728	4475	4f229366-dbe3-4361-84cb-115cab42685f	2.872454e+06	1	2.872454e+06	t	2026-01-17 05:27:40.872087	f
729	4475	51f792dc-04f3-467f-a604-631165c75b38	3.016077e+06	1	3.016077e+06	t	2026-01-17 05:27:41.28477	f
730	4475	4f229366-dbe3-4361-84cb-115cab42685f	3.166881e+06	1	3.166881e+06	t	2026-01-17 05:27:41.652753	f
731	4477	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	t	2026-01-17 05:30:24.489439	f
732	4507	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.116495e+06	1	2.116495e+06	f	2026-01-17 07:40:38.785377	f
733	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.777856e+06	2	2.22232e+06	t	2026-01-17 07:40:39.227257	f
734	4507	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.866749e+06	2	2.3334362e+06	f	2026-01-17 07:40:56.524188	f
735	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.960087e+06	2	2.4501088e+06	t	2026-01-17 07:40:56.960292	f
736	4507	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.058092e+06	2	2.572615e+06	f	2026-01-17 07:41:12.486535	f
737	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.160997e+06	2	2.7012462e+06	t	2026-01-17 07:41:12.913818	f
738	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.518755e+06	2	4.398444e+06	t	2026-01-17 14:13:24.650018	f
739	4570	388f55c3-52e1-499f-8a56-948636a8c205	3.186207e+06	4	4.556276e+06	t	2026-01-17 14:32:30.636761	f
740	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.20072e+06	1	5.20072e+06	f	2026-01-17 14:46:43.642327	f
741	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.105832e+06	3	5.4607565e+06	t	2026-01-17 14:46:44.784793	f
742	4507	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.269047e+06	2	2.8363088e+06	f	2026-01-17 14:51:30.001898	f
743	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.3825e+06	2	2.978125e+06	t	2026-01-17 14:51:31.065414	f
744	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.311124e+06	3	5.733795e+06	f	2026-01-17 14:52:13.696912	f
745	4509	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.307603e+06	2	4.1345038e+06	f	2026-01-17 14:52:55.553435	f
746	4563	5d77ac22-c768-4d3b-99d8-73c250a3e859	739000	1	739000	f	2026-01-17 14:57:25.901908	f
747	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.316777e+06	1	2.316777e+06	t	2026-01-17 15:22:04.160184	f
748	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.432616e+06	1	2.432616e+06	t	2026-01-17 15:22:04.583775	f
749	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.554247e+06	1	2.554247e+06	t	2026-01-17 15:22:04.956169	f
750	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.68196e+06	1	2.68196e+06	t	2026-01-17 15:22:05.318566	f
751	4494	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.816058e+06	1	2.816058e+06	t	2026-01-17 15:22:05.695587	f
752	4484	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.952433e+06	2	3.6905412e+06	t	2026-01-17 15:36:58.899886	f
753	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.526681e+06	3	6.0204855e+06	t	2026-01-17 15:38:23.048915	f
754	4844	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.949838e+06	3	6.5832845e+06	f	2026-01-17 15:45:16.766408	f
755	4844	51f792dc-04f3-467f-a604-631165c75b38	5.19733e+06	3	6.912449e+06	t	2026-01-17 15:45:17.17782	f
756	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.325226e+06	1	3.325226e+06	f	2026-01-17 16:13:46.75507	f
757	4475	4f229366-dbe3-4361-84cb-115cab42685f	3.491488e+06	1	3.491488e+06	t	2026-01-17 16:13:47.289409	f
758	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.666063e+06	1	3.666063e+06	f	2026-01-17 16:13:59.429397	f
759	4475	4f229366-dbe3-4361-84cb-115cab42685f	3.849367e+06	1	3.849367e+06	t	2026-01-17 16:13:59.84794	f
760	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.041836e+06	1	4.041836e+06	f	2026-01-17 16:14:08.447265	f
761	4475	4f229366-dbe3-4361-84cb-115cab42685f	4.243928e+06	1	4.243928e+06	t	2026-01-17 16:14:08.865702	f
762	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.694693e+06	2	4.618366e+06	t	2026-01-17 16:26:18.249371	f
763	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.879428e+06	2	4.849285e+06	t	2026-01-17 16:26:18.663547	f
764	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.0734e+06	2	5.09175e+06	t	2026-01-17 16:26:19.016911	f
765	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.27707e+06	2	5.3463375e+06	t	2026-01-17 16:26:19.375683	f
766	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.490924e+06	2	5.613655e+06	t	2026-01-17 16:26:19.737858	f
767	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.715471e+06	2	5.894339e+06	t	2026-01-17 16:26:20.097889	f
768	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.951245e+06	2	6.189056e+06	t	2026-01-17 16:26:20.465908	f
769	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.501625e+06	2	3.1270312e+06	t	2026-01-17 16:32:21.842602	f
770	4494	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.365489e+06	2	2.9568612e+06	t	2026-01-17 18:33:09.963499	f
771	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.753015e+06	3	6.32151e+06	t	2026-01-17 18:33:52.962325	f
772	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.990666e+06	3	6.637586e+06	t	2026-01-17 18:33:53.382515	f
773	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.2402e+06	3	6.969466e+06	t	2026-01-17 18:33:53.744327	f
774	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.456125e+06	1	4.456125e+06	f	2026-01-17 19:07:08.863303	f
775	4475	4f229366-dbe3-4361-84cb-115cab42685f	4.678932e+06	1	4.678932e+06	t	2026-01-17 19:07:09.954085	f
776	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.448451e+06	2	5.560564e+06	f	2026-01-17 19:09:30.047626	f
777	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.198808e+06	2	6.49851e+06	f	2026-01-17 19:11:55.360184	f
778	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.458749e+06	2	6.823436e+06	t	2026-01-17 19:11:55.859322	f
779	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.386924e+06	3	7.164609e+06	f	2026-01-17 19:12:07.989995	f
780	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.912879e+06	1	4.912879e+06	f	2026-01-17 19:12:58.135216	f
781	4497	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	4.389919e+06	3	5.8385925e+06	f	2026-01-17 19:16:49.068466	f
782	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	1	420000	f	2026-01-17 19:18:56.101133	f
783	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.626707e+06	2	3.2833838e+06	t	2026-01-17 19:24:59.070084	f
784	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.758043e+06	2	3.4475538e+06	t	2026-01-17 19:24:59.513634	f
785	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.895946e+06	2	3.6199325e+06	t	2026-01-17 19:24:59.914469	f
786	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.040744e+06	2	3.80093e+06	t	2026-01-17 19:25:00.290578	f
787	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.192782e+06	2	3.9909775e+06	t	2026-01-17 19:25:00.700768	f
788	4497	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.904418e+06	2	6.1305225e+06	f	2026-01-17 19:56:34.136987	f
789	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.854352e+06	2	7.31794e+06	f	2026-01-17 20:02:06.047979	f
790	4477	4f229366-dbe3-4361-84cb-115cab42685f	400000	3	532000	t	2026-01-17 20:07:17.757905	f
791	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	3.59706e+06	3	4.78409e+06	f	2026-01-17 21:01:17.281278	f
792	4570	388f55c3-52e1-499f-8a56-948636a8c205	3.512794e+06	4	5.0232955e+06	t	2026-01-17 21:01:17.714819	f
793	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	3.96576e+06	3	5.274461e+06	f	2026-01-17 21:01:29.699575	f
794	4570	388f55c3-52e1-499f-8a56-948636a8c205	3.872856e+06	4	5.538184e+06	t	2026-01-17 21:01:30.132617	f
795	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	4.372251e+06	3	5.815094e+06	f	2026-01-17 21:01:38.339919	f
796	4570	388f55c3-52e1-499f-8a56-948636a8c205	4.269825e+06	4	6.10585e+06	t	2026-01-17 21:01:38.775658	f
797	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	4.820408e+06	3	6.4111425e+06	f	2026-01-17 21:01:46.941184	f
798	4570	388f55c3-52e1-499f-8a56-948636a8c205	4.707483e+06	4	6.7317005e+06	t	2026-01-17 21:01:47.373455	f
799	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.839887e+06	3	6.4370495e+06	t	2026-01-17 21:02:09.186038	f
800	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.777322e+06	3	7.6838385e+06	t	2026-01-17 21:02:39.315997	f
801	4475	6f591686-4009-4693-a2c7-d3eb1b36073f	5.158523e+06	1	5.158523e+06	f	2026-01-17 21:03:16.3629	f
802	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.41645e+06	1	5.41645e+06	t	2026-01-17 21:03:16.775137	f
803	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.066189e+06	3	8.0680315e+06	t	2026-01-17 21:16:34.5309	f
804	4499	e2831203-b5bb-4911-9a98-485fe4c6e3b5	6.369499e+06	3	8.471434e+06	t	2026-01-17 21:16:34.958	f
805	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.687975e+06	3	8.895007e+06	t	2026-01-17 21:16:57.765002	f
806	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.018272e+06	2	7.52284e+06	t	2026-01-17 21:17:44.21015	f
807	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.352422e+06	2	4.1905275e+06	t	2026-01-17 21:18:06.506232	f
808	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.520044e+06	2	4.400055e+06	t	2026-01-17 21:18:06.918269	f
809	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.696047e+06	2	4.620059e+06	t	2026-01-17 21:18:07.277858	f
810	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.88085e+06	2	4.8510625e+06	t	2026-01-17 21:18:07.637116	f
811	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.074893e+06	2	5.093616e+06	t	2026-01-17 21:18:08.002855	f
812	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	3	558600	t	2026-01-17 21:25:31.953159	f
813	4477	4f229366-dbe3-4361-84cb-115cab42685f	441000	3	586530	t	2026-01-17 21:25:32.378484	f
814	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	463050	3	615856.5	t	2026-01-17 21:25:32.749093	f
815	4477	4f229366-dbe3-4361-84cb-115cab42685f	486203	3	646650	t	2026-01-17 21:25:33.132093	f
816	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	510514	3	678983.6	t	2026-01-17 21:25:33.497222	f
817	4477	4f229366-dbe3-4361-84cb-115cab42685f	536040	3	712933.2	t	2026-01-17 21:25:33.868621	f
818	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	562842	3	748579.9	t	2026-01-17 21:25:34.236096	f
819	4477	4f229366-dbe3-4361-84cb-115cab42685f	590985	3	786010.06	t	2026-01-17 21:25:34.604368	f
820	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	620535	3	825311.56	t	2026-01-17 21:25:34.978138	f
821	4477	4f229366-dbe3-4361-84cb-115cab42685f	651562	3	866577.44	t	2026-01-17 21:25:35.348605	f
822	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	684141	3	909907.5	t	2026-01-17 21:25:35.718985	f
823	4477	4f229366-dbe3-4361-84cb-115cab42685f	718349	3	955404.2	t	2026-01-17 21:25:36.099238	f
824	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	754267	3	1.0031751e+06	t	2026-01-17 21:25:36.478973	f
825	4477	4f229366-dbe3-4361-84cb-115cab42685f	791981	3	1.0533348e+06	t	2026-01-17 21:25:36.851317	f
826	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	831581	3	1.1060028e+06	t	2026-01-17 21:25:37.224366	f
827	4497	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	4.726505e+06	4	6.758902e+06	f	2026-01-17 22:19:29.808484	f
828	4497	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.335976e+06	3	7.096848e+06	t	2026-01-17 22:19:30.3352	f
829	4497	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	5.210973e+06	4	7.4516915e+06	f	2026-01-17 22:20:16.717367	f
830	4844	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	6e+06	4	8.58e+06	f	2026-01-17 22:32:17.096246	f
831	4844	51f792dc-04f3-467f-a604-631165c75b38	6.773685e+06	3	9.009001e+06	t	2026-01-17 22:32:17.569015	f
832	4844	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	7e+06	4	1.001e+07	f	2026-01-17 22:33:05.695024	f
833	4844	51f792dc-04f3-467f-a604-631165c75b38	7.902632e+06	3	1.0510501e+07	t	2026-01-17 22:33:06.120724	f
834	4536	6f591686-4009-4693-a2c7-d3eb1b36073f	4.916636e+06	1	4.916636e+06	f	2026-01-17 23:34:29.710982	f
835	4489	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	1	400000	f	2026-01-17 23:39:10.441263	f
836	4539	f335b9c3-7d63-44f3-9540-13b1d461ca13	412000	1	412000	f	2026-01-17 23:40:41.729768	f
837	4477	4f229366-dbe3-4361-84cb-115cab42685f	873161	3	1.1613041e+06	t	2026-01-17 23:41:12.726453	f
838	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	916820	3	1.2193706e+06	t	2026-01-17 23:41:13.156329	f
839	4477	4f229366-dbe3-4361-84cb-115cab42685f	962661	3	1.2803391e+06	t	2026-01-17 23:41:13.516327	f
840	4499	5d77ac22-c768-4d3b-99d8-73c250a3e859	7.471806e+06	2	9.339758e+06	f	2026-01-18 01:25:43.308222	f
841	4499	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.373494e+06	3	9.806747e+06	t	2026-01-18 01:25:43.726387	f
842	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	6.864354e+06	1	6.864354e+06	f	2026-01-18 01:26:52.528519	f
843	4520	51f792dc-04f3-467f-a604-631165c75b38	5.766058e+06	2	7.2075725e+06	t	2026-01-18 01:26:52.955292	f
844	4484	5084741d-1673-42b3-a8e3-3d422874e814	3.100055e+06	2	3.8750688e+06	f	2026-01-18 01:47:38.942789	f
845	4484	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.255058e+06	2	4.0688225e+06	t	2026-01-18 01:47:39.367578	f
846	4484	5084741d-1673-42b3-a8e3-3d422874e814	3.417811e+06	2	4.272264e+06	f	2026-01-18 01:48:20.006246	f
847	4484	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.588702e+06	2	4.4858775e+06	t	2026-01-18 01:48:20.435116	f
848	4484	5084741d-1673-42b3-a8e3-3d422874e814	3.768138e+06	2	4.7101725e+06	f	2026-01-18 01:50:14.318925	f
849	4500	51f792dc-04f3-467f-a604-631165c75b38	1.3928991e+07	1	1.3928991e+07	t	2026-01-18 01:54:41.368905	f
850	4475	51f792dc-04f3-467f-a604-631165c75b38	5.687273e+06	1	5.687273e+06	t	2026-01-18 01:56:21.594204	f
851	4475	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.971637e+06	1	5.971637e+06	t	2026-01-18 01:56:22.018484	f
852	4475	51f792dc-04f3-467f-a604-631165c75b38	6.270219e+06	1	6.270219e+06	t	2026-01-18 01:56:56.49044	f
853	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.010795e+06	3	1.3443574e+06	f	2026-01-18 02:06:21.563416	f
854	4477	4f229366-dbe3-4361-84cb-115cab42685f	1.061335e+06	3	1.4115755e+06	t	2026-01-18 02:06:22.000121	f
855	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.167469e+06	3	1.5527338e+06	f	2026-01-18 02:06:46.253209	f
856	4477	4f229366-dbe3-4361-84cb-115cab42685f	1.225843e+06	3	1.6303712e+06	t	2026-01-18 02:06:46.687465	f
857	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.287136e+06	3	1.7118909e+06	f	2026-01-18 02:07:34.431157	f
858	4477	4f229366-dbe3-4361-84cb-115cab42685f	1.351493e+06	3	1.7974858e+06	t	2026-01-18 02:07:35.029354	f
859	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.419068e+06	3	1.8873605e+06	f	2026-01-18 02:08:21.089817	f
860	4477	4f229366-dbe3-4361-84cb-115cab42685f	1.490022e+06	3	1.9817292e+06	t	2026-01-18 02:08:21.50261	f
861	4477	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.564524e+06	3	2.0808169e+06	f	2026-01-18 02:09:24.061525	f
862	4497	6f591686-4009-4693-a2c7-d3eb1b36073f	5.882915e+06	3	7.824277e+06	f	2026-01-18 02:29:05.805164	f
863	4497	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	5.745099e+06	4	8.2154915e+06	f	2026-01-18 02:29:44.442855	f
864	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	7.567952e+06	1	7.567952e+06	f	2026-01-18 03:39:48.011577	f
865	4520	51f792dc-04f3-467f-a604-631165c75b38	6.35708e+06	2	7.94635e+06	t	2026-01-18 03:39:48.419634	f
866	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	8.343668e+06	1	8.343668e+06	t	2026-01-18 03:40:11.56693	f
867	4520	51f792dc-04f3-467f-a604-631165c75b38	7.008682e+06	2	8.760852e+06	t	2026-01-18 03:40:11.982237	f
868	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	9.198895e+06	1	9.198895e+06	f	2026-01-18 03:41:03.901595	f
869	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.939085e+06	3	7.898983e+06	f	2026-01-18 03:45:03.799932	f
870	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.635146e+06	2	8.2939325e+06	t	2026-01-18 03:45:04.211762	f
871	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	6.547842e+06	3	8.70863e+06	f	2026-01-18 03:45:17.618576	f
872	4568	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	400000	1	400000	f	2026-01-18 03:47:43.07886	f
873	4522	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	2	500000	t	2026-01-18 04:19:50.260141	f
874	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	412000	2	515000	t	2026-01-18 04:27:27.448347	f
875	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	739000	2	923750	t	2026-01-18 04:29:41.428873	f
876	4505	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-18 05:13:18.310308	f
877	4523	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-18 05:17:01.397723	f
878	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.31525e+06	2	9.144062e+06	t	2026-01-18 05:18:18.229715	f
879	4549	5d77ac22-c768-4d3b-99d8-73c250a3e859	7.218997e+06	3	9.601266e+06	f	2026-01-18 05:44:17.487249	f
880	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.021276e+06	3	5.348297e+06	t	2026-01-18 13:33:51.343316	f
881	4577	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	6.284332e+06	4	8.986595e+06	t	2026-01-18 14:00:52.070359	f
882	4577	17faf686-27d1-4e30-a11c-4e7ec21ca685	7.094681e+06	3	9.435926e+06	t	2026-01-18 14:00:52.609914	f
883	4577	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	6.928478e+06	4	9.907724e+06	t	2026-01-18 14:00:53.074466	f
884	4577	17faf686-27d1-4e30-a11c-4e7ec21ca685	7.821888e+06	3	1.0403111e+07	t	2026-01-18 14:00:53.799439	f
885	4577	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	7.638648e+06	4	1.0923267e+07	t	2026-01-18 14:00:54.256393	f
886	4587	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.371276e+06	2	6.714095e+06	t	2026-01-18 14:11:10.182038	f
887	4585	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	400000	1	400000	t	2026-01-18 14:11:33.980629	f
888	4509	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.307603e+06	3	4.399112e+06	t	2026-01-18 14:17:56.253666	f
889	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	5	620000	t	2026-01-18 14:20:24.480745	f
890	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	489474	3	651000.44	t	2026-01-18 14:20:38.180534	f
891	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	441001	5	683551.56	t	2026-01-18 14:20:59.580461	f
892	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	539646	3	717729.2	t	2026-01-18 14:21:09.58277	f
893	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	486204	5	753616.2	t	2026-01-18 14:21:21.736428	f
894	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	594961	3	791298.1	t	2026-01-18 14:21:22.316705	f
895	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	536041	5	830863.56	t	2026-01-18 14:21:22.718651	f
896	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	655945	3	872406.9	t	2026-01-18 14:21:23.101055	f
897	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	590986	5	916028.3	t	2026-01-18 14:21:23.980682	f
898	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	723181	3	961830.75	t	2026-01-18 14:21:35.184426	f
899	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	651563	5	1.0099226e+06	t	2026-01-18 14:21:48.18295	f
900	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	797308	3	1.0604196e+06	t	2026-01-18 14:21:52.457034	f
901	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	718349	5	1.113441e+06	t	2026-01-18 14:21:52.985469	f
902	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	879033	3	1.1691139e+06	t	2026-01-18 14:21:53.425489	f
903	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	791981	5	1.2275705e+06	t	2026-01-18 14:21:53.808935	f
904	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	969135	3	1.2889495e+06	t	2026-01-18 14:21:54.194102	f
905	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	873160	5	1.353398e+06	t	2026-01-18 14:21:54.557255	f
906	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.068473e+06	3	1.4210691e+06	t	2026-01-18 14:21:54.916538	f
907	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	962660	5	1.492123e+06	t	2026-01-18 14:22:10.3808	f
908	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.177992e+06	3	1.5667294e+06	t	2026-01-18 14:22:18.564462	f
909	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.061333e+06	5	1.6450661e+06	t	2026-01-18 14:22:18.980595	f
910	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.298737e+06	3	1.7273202e+06	t	2026-01-18 14:22:31.284571	f
911	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.170121e+06	5	1.8136875e+06	t	2026-01-18 14:22:35.834237	f
912	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.431859e+06	3	1.9043725e+06	t	2026-01-18 14:22:36.331368	f
913	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.290059e+06	5	1.9995915e+06	t	2026-01-18 14:22:36.743229	f
914	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.578625e+06	3	2.0995712e+06	t	2026-01-18 14:22:37.127344	f
915	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.422291e+06	5	2.204551e+06	t	2026-01-18 14:22:45.28446	f
916	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.740436e+06	3	2.31478e+06	t	2026-01-18 14:22:58.583863	f
917	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.568077e+06	5	2.4305192e+06	t	2026-01-18 14:23:01.10444	f
918	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.918831e+06	3	2.5520452e+06	t	2026-01-18 14:23:01.498683	f
919	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.728805e+06	5	2.6796478e+06	t	2026-01-18 14:23:01.890015	f
920	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.115512e+06	3	2.813631e+06	t	2026-01-18 14:23:02.2744	f
921	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.906009e+06	5	2.954314e+06	t	2026-01-18 14:23:02.855106	f
922	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.332354e+06	3	3.1020308e+06	t	2026-01-18 14:23:03.289857	f
923	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.101376e+06	5	3.2571328e+06	t	2026-01-18 14:23:03.687476	f
924	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.571421e+06	3	3.41999e+06	t	2026-01-18 14:23:07.280266	f
925	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.316768e+06	5	3.5909905e+06	t	2026-01-18 14:23:12.794154	f
926	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.834993e+06	3	3.7705408e+06	t	2026-01-18 14:23:13.292346	f
927	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.554238e+06	5	3.959069e+06	t	2026-01-18 14:23:13.668591	f
928	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.125581e+06	3	4.1570228e+06	t	2026-01-18 14:23:14.017704	f
929	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.816048e+06	5	4.3648745e+06	t	2026-01-18 14:23:14.368307	f
930	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.445954e+06	3	4.583119e+06	t	2026-01-18 14:23:23.880495	f
931	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.104694e+06	5	4.8122755e+06	t	2026-01-18 14:23:47.093882	f
932	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.799165e+06	3	5.0528895e+06	t	2026-01-18 14:23:47.48023	f
933	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.422926e+06	5	5.3055355e+06	t	2026-01-18 14:23:47.863766	f
934	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	3.594073e+06	3	4.780117e+06	t	2026-01-18 14:23:48.510421	f
935	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	t	2026-01-18 14:30:47.841896	f
936	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	3	532000	t	2026-01-18 14:30:49.044183	f
937	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	420000	3	558600	t	2026-01-18 14:30:49.467889	f
938	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	441000	3	586530	t	2026-01-18 14:30:49.858691	f
939	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	463050	3	615856.5	t	2026-01-18 14:30:59.082307	f
940	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	486203	3	646650	t	2026-01-18 14:30:59.965388	f
941	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	510514	3	678983.6	t	2026-01-18 14:31:09.782129	f
942	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	536040	3	712933.2	t	2026-01-18 14:31:20.880919	f
943	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	562842	3	748579.9	t	2026-01-18 14:31:37.684115	f
944	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	590985	3	786010.06	t	2026-01-18 14:31:53.3819	f
945	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	620535	3	825311.56	t	2026-01-18 14:32:06.982489	f
946	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	651562	3	866577.44	t	2026-01-18 14:32:19.381197	f
947	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	684141	3	909907.5	t	2026-01-18 14:32:32.080253	f
948	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	718349	3	955404.2	t	2026-01-18 14:32:56.483338	f
949	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	754267	3	1.0031751e+06	t	2026-01-18 14:33:08.483075	f
950	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	791981	3	1.0533348e+06	t	2026-01-18 14:33:36.682304	f
951	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	831581	3	1.1060028e+06	t	2026-01-18 14:33:54.180691	f
952	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	873161	3	1.1613041e+06	t	2026-01-18 14:34:06.684005	f
953	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	916820	3	1.2193706e+06	t	2026-01-18 14:34:32.280646	f
954	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	962661	3	1.2803391e+06	t	2026-01-18 14:34:47.983227	f
955	4604	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.010795e+06	1	1.010795e+06	t	2026-01-18 14:35:02.780347	f
956	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.010795e+06	3	1.3443574e+06	t	2026-01-18 14:35:06.181252	f
957	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.010795e+06	3	1.3443574e+06	t	2026-01-18 14:35:17.782807	f
958	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.061335e+06	3	1.4115755e+06	t	2026-01-18 14:35:30.883226	f
959	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.061335e+06	3	1.4115755e+06	t	2026-01-18 14:35:48.480572	f
960	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.114402e+06	3	1.4821546e+06	t	2026-01-18 14:35:54.280307	f
961	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.114402e+06	3	1.4821546e+06	t	2026-01-18 14:36:05.383799	f
962	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.170123e+06	3	1.5562636e+06	t	2026-01-18 14:36:07.68071	f
963	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.170123e+06	3	1.5562636e+06	t	2026-01-18 14:36:31.481226	f
964	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.22863e+06	3	1.6340779e+06	t	2026-01-18 14:36:34.482793	f
965	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.22863e+06	3	1.6340779e+06	t	2026-01-18 14:36:52.080524	f
966	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.290062e+06	3	1.7157825e+06	t	2026-01-18 14:36:55.082917	f
967	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.290062e+06	3	1.7157825e+06	t	2026-01-18 14:37:10.057245	f
968	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.354566e+06	3	1.8015728e+06	t	2026-01-18 14:37:10.118644	f
969	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.354566e+06	3	1.8015728e+06	t	2026-01-18 14:37:14.916808	f
970	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.422295e+06	3	1.8916524e+06	t	2026-01-18 14:37:14.925772	f
971	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.49341e+06	3	1.9862352e+06	t	2026-01-18 14:37:15.722197	f
972	4604	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.986236e+06	1	1.986236e+06	t	2026-01-18 14:37:15.815561	f
973	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.568081e+06	3	2.0855478e+06	t	2026-01-18 14:37:16.367116	f
974	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.568082e+06	3	2.085549e+06	t	2026-01-18 14:37:16.420027	f
975	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.646486e+06	3	2.1898265e+06	t	2026-01-18 14:37:16.8735	f
976	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.646487e+06	3	2.1898278e+06	t	2026-01-18 14:37:16.985051	f
979	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.815252e+06	3	2.4142852e+06	t	2026-01-18 14:37:18.76942	f
988	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.206453e+06	3	2.9345825e+06	t	2026-01-18 14:37:49.372072	f
1013	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.160603e+06	3	5.533602e+06	t	2026-01-18 14:42:37.182175	f
1014	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.160603e+06	3	5.533602e+06	t	2026-01-18 14:42:38.980331	f
1015	4568	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	420000	1	420000	t	2026-01-18 15:02:26.596592	f
1292	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.144768e+06	3	4.1825415e+06	t	2026-01-20 02:19:53.493065	f
1314	4671	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	701000	1	701000	t	2026-01-20 14:30:58.980795	f
1317	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	606000	2	757500	t	2026-01-20 17:35:33.851048	f
1328	4592	51f792dc-04f3-467f-a604-631165c75b38	1.468919e+06	1	1.468919e+06	t	2026-01-20 17:35:55.751319	f
1332	4592	51f792dc-04f3-467f-a604-631165c75b38	1.785482e+06	1	1.785482e+06	t	2026-01-20 17:36:51.250513	f
1333	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.499805e+06	2	1.8747562e+06	t	2026-01-20 17:37:01.147431	f
1362	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.823024e+06	2	2.27878e+06	t	2026-01-20 21:12:36.959906	f
1365	4586	51f792dc-04f3-467f-a604-631165c75b38	3e+06	1	3e+06	f	2026-01-20 22:11:36.569827	f
1405	4596	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.85155e+06	1	3.85155e+06	f	2026-01-20 23:32:11.041572	f
1406	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	4.044128e+06	1	4.044128e+06	t	2026-01-20 23:32:11.441957	f
1407	4598	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	2	525000	f	2026-01-20 23:32:24.134854	f
1408	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-20 23:32:24.528783	f
1411	4598	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	510514	2	638142.5	f	2026-01-20 23:32:38.551582	f
1412	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-20 23:32:38.959151	f
1448	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	754267	2	942833.75	t	2026-01-21 01:25:45.263752	f
1449	4598	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	989976	1	989976	t	2026-01-21 01:25:45.706577	f
1450	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	831580	2	1.039475e+06	t	2026-01-21 01:25:46.108514	f
1451	4598	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.091449e+06	1	1.091449e+06	t	2026-01-21 01:25:46.487276	f
1468	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.082914e+07	1	1.082914e+07	f	2026-01-21 02:23:39.489034	f
1469	4603	51f792dc-04f3-467f-a604-631165c75b38	1.1370597e+07	1	1.1370597e+07	t	2026-01-21 02:23:39.898504	f
1493	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	420000	1	420000	t	2026-01-21 06:44:32.078659	f
1494	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	740000	1	740000	t	2026-01-21 13:38:27.409054	f
1523	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	525000	1	525000	t	2026-01-21 14:45:26.090725	f
1524	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	551250	1	551250	t	2026-01-21 14:45:26.517704	f
1525	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	578813	1	578813	t	2026-01-21 14:45:26.896308	f
1526	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	607754	1	607754	t	2026-01-21 14:45:27.254186	f
1527	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	638142	1	638142	t	2026-01-21 14:45:27.624087	f
1528	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	670050	1	670050	t	2026-01-21 14:45:28.005582	f
1529	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	703553	1	703553	t	2026-01-21 14:45:28.380682	f
1530	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	738731	1	738731	t	2026-01-21 14:45:28.802616	f
1531	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	775668	1	775668	t	2026-01-21 14:45:29.161925	f
1532	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	814452	1	814452	t	2026-01-21 14:45:29.513444	f
1533	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	855175	1	855175	t	2026-01-21 14:45:29.862918	f
1534	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	897934	1	897934	t	2026-01-21 14:45:30.221127	f
1535	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	942831	1	942831	t	2026-01-21 14:45:30.579976	f
1536	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	989973	1	989973	t	2026-01-21 14:45:30.938745	f
1537	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	1.039472e+06	1	1.039472e+06	t	2026-01-21 14:45:31.311671	f
1568	4614	51f792dc-04f3-467f-a604-631165c75b38	1.847186e+06	2	2.3089825e+06	t	2026-01-21 16:25:41.658374	f
1576	4614	51f792dc-04f3-467f-a604-631165c75b38	2.729141e+06	2	3.4114262e+06	t	2026-01-21 16:25:47.215487	f
1589	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.840179e+06	2	4.800224e+06	f	2026-01-21 23:05:39.554995	f
1592	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	3.12829e+06	2	3.9103625e+06	t	2026-01-22 00:35:10.613885	f
1593	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.105881e+06	1	4.105881e+06	t	2026-01-22 00:35:11.101072	f
1594	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	3.448941e+06	2	4.311176e+06	t	2026-01-22 00:35:11.518338	f
1615	4611	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	4.990726e+06	1	4.990726e+06	t	2026-01-22 01:46:34.146617	f
1648	4664	0477609b-080d-4cd2-b891-117e615bdf47	441000	2	551250	f	2026-01-22 12:54:46.042932	f
1649	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	578813	1	578813	t	2026-01-22 12:54:46.849266	f
1654	4664	0477609b-080d-4cd2-b891-117e615bdf47	590985	2	738731.25	t	2026-01-22 12:55:08.046809	f
1655	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	775668	1	775668	t	2026-01-22 12:55:08.709237	f
1663	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.14602e+06	1	1.14602e+06	t	2026-01-22 12:56:02.616597	f
1665	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.063153e+06	2	1.3289412e+06	t	2026-01-22 13:15:55.389028	f
1667	4709	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	2	500000	t	2026-01-22 14:05:18.843604	f
1682	4660	02538c92-2a46-43e6-8351-33297d6de099	1.1868603e+07	2	1.4835754e+07	f	2026-01-22 15:49:57.093991	f
1683	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.5577542e+07	1	1.5577542e+07	t	2026-01-22 15:49:57.55392	f
1706	4685	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.462645e+06	1	1.462645e+06	f	2026-01-22 17:08:07.137255	f
1707	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.792934e+06	1	2.792934e+06	t	2026-01-22 17:08:54.086519	f
1712	4719	5084741d-1673-42b3-a8e3-3d422874e814	7.610239e+06	4	1.0882642e+07	f	2026-01-22 18:16:16.2737	f
1751	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.040747e+06	1	3.040747e+06	t	2026-01-22 18:43:10.901835	f
1752	4647	51f792dc-04f3-467f-a604-631165c75b38	2.554228e+06	2	3.192785e+06	t	2026-01-22 18:43:11.310163	f
1753	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.352425e+06	1	3.352425e+06	t	2026-01-22 18:43:11.731636	f
1754	4647	51f792dc-04f3-467f-a604-631165c75b38	2.816037e+06	2	3.5200462e+06	t	2026-01-22 18:43:12.123772	f
1778	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.354565e+06	1	1.354565e+06	t	2026-01-22 20:08:28.837465	f
1836	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.8032952e+07	1	1.8032952e+07	t	2026-01-22 23:21:24.809824	f
1852	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	450702	1	450702	t	2026-01-23 00:37:45.427283	f
1869	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.501628e+06	1	2.501628e+06	t	2026-01-23 01:52:59.385858	f
1880	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	638142	1	638142	f	2026-01-23 02:13:25.928004	f
1881	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	536040	2	670050	t	2026-01-23 02:13:26.351182	f
1900	4659	02538c92-2a46-43e6-8351-33297d6de099	1.7644304e+07	2	2.2055382e+07	f	2026-01-23 02:14:45.057194	f
1906	4660	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.5907674e+07	2	3.2384592e+07	t	2026-01-23 02:19:41.755932	f
1921	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.040743e+06	1	3.040743e+06	t	2026-01-23 02:32:08.15342	f
977	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.728811e+06	3	2.2993188e+06	t	2026-01-18 14:37:17.440005	f
1001	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.104702e+06	3	4.1292538e+06	t	2026-01-18 14:40:07.180711	f
1004	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.259939e+06	3	4.335719e+06	t	2026-01-18 14:40:31.980337	f
1007	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.594082e+06	3	4.780129e+06	t	2026-01-18 14:41:15.380668	f
1293	4597	cc78d40c-9179-4616-9834-9aa9c69963fa	400000	1	400000	t	2026-01-20 02:35:50.504205	f
1315	4593	02538c92-2a46-43e6-8351-33297d6de099	8.2583e+06	3	1.0983539e+07	f	2026-01-20 14:46:17.594299	f
1316	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	8.671215e+06	3	1.1532716e+07	t	2026-01-20 14:46:18.007609	f
1318	4592	51f792dc-04f3-467f-a604-631165c75b38	795375	1	795375	t	2026-01-20 17:35:34.679703	f
1327	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.119176e+06	2	1.39897e+06	t	2026-01-20 17:35:43.119432	f
1334	4592	51f792dc-04f3-467f-a604-631165c75b38	1.968495e+06	1	1.968495e+06	t	2026-01-20 17:37:13.647595	f
1335	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.653536e+06	2	2.06692e+06	t	2026-01-20 17:37:47.247626	f
1338	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.299267e+06	2	2.8740838e+06	t	2026-01-20 18:34:41.231633	f
1339	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	3.017788e+06	1	3.017788e+06	t	2026-01-20 18:34:41.636386	f
1363	4592	6f591686-4009-4693-a2c7-d3eb1b36073f	2.392719e+06	1	2.392719e+06	f	2026-01-20 21:33:33.112342	f
1364	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.009884e+06	2	2.512355e+06	t	2026-01-20 21:33:33.532064	f
1366	4592	51f792dc-04f3-467f-a604-631165c75b38	2.637973e+06	1	2.637973e+06	t	2026-01-20 22:12:57.980472	f
1367	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.215898e+06	2	2.7698725e+06	t	2026-01-20 22:12:58.402744	f
1368	4592	51f792dc-04f3-467f-a604-631165c75b38	2.908367e+06	1	2.908367e+06	t	2026-01-20 22:12:58.785597	f
1369	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.443029e+06	2	3.0537862e+06	t	2026-01-20 22:12:59.158491	f
1370	4592	51f792dc-04f3-467f-a604-631165c75b38	3.206476e+06	1	3.206476e+06	t	2026-01-20 22:12:59.520433	f
1371	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.69344e+06	2	3.3668e+06	t	2026-01-20 22:12:59.868986	f
1372	4592	51f792dc-04f3-467f-a604-631165c75b38	3.53514e+06	1	3.53514e+06	t	2026-01-20 22:13:00.222805	f
1373	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.969518e+06	2	3.7118975e+06	t	2026-01-20 22:13:00.579426	f
1374	4592	51f792dc-04f3-467f-a604-631165c75b38	3.897493e+06	1	3.897493e+06	t	2026-01-20 22:13:00.92749	f
1375	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.273895e+06	2	4.0923688e+06	t	2026-01-20 22:13:01.319996	f
1409	4598	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	463050	2	578812.5	f	2026-01-20 23:32:31.697432	f
1410	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-20 23:32:32.11243	f
1452	4596	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.419522e+06	1	5.419522e+06	t	2026-01-21 01:36:23.036406	f
1470	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	9.551302e+06	2	1.1939128e+07	t	2026-01-21 02:24:09.598892	f
1495	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-21 14:00:27.289482	f
1503	4647	51f792dc-04f3-467f-a604-631165c75b38	590985	2	738731.25	t	2026-01-21 14:08:18.686712	f
1510	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.039473e+06	1	1.039473e+06	t	2026-01-21 14:09:12.183399	f
1538	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.334375e+06	2	2.9179688e+06	t	2026-01-21 15:14:14.665138	f
1539	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.063868e+06	1	3.063868e+06	t	2026-01-21 15:14:15.07523	f
1540	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.57365e+06	2	3.2170625e+06	t	2026-01-21 15:14:15.449002	f
1541	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.377916e+06	1	3.377916e+06	t	2026-01-21 15:14:15.799486	f
1542	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	1	441000	t	2026-01-21 15:14:36.752213	f
1569	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.939546e+06	2	2.4244325e+06	t	2026-01-21 16:25:42.375713	f
1570	4614	51f792dc-04f3-467f-a604-631165c75b38	2.036524e+06	2	2.545655e+06	t	2026-01-21 16:25:43.108804	f
1572	4614	51f792dc-04f3-467f-a604-631165c75b38	2.245269e+06	2	2.8065862e+06	t	2026-01-21 16:25:44.522866	f
1590	4671	5d77ac22-c768-4d3b-99d8-73c250a3e859	736050	1	736050	f	2026-01-21 23:12:51.874221	f
1591	4671	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	772853	1	772853	t	2026-01-21 23:12:52.496889	f
1595	4611	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.621388e+06	2	4.526735e+06	f	2026-01-22 00:59:33.031964	f
1616	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.22863e+06	1	1.22863e+06	f	2026-01-22 01:48:14.726907	f
1617	4633	51f792dc-04f3-467f-a604-631165c75b38	1.290062e+06	1	1.290062e+06	t	2026-01-22 01:48:15.14015	f
1634	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	400000	1	400000	t	2026-01-22 05:46:57.708767	f
1650	4664	0477609b-080d-4cd2-b891-117e615bdf47	486203	2	607753.75	t	2026-01-22 12:55:05.238534	f
1651	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	638142	1	638142	t	2026-01-22 12:55:05.982133	f
1657	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	855176	1	855176	t	2026-01-22 12:55:28.037207	f
1662	4664	0477609b-080d-4cd2-b891-117e615bdf47	873158	2	1.0914475e+06	f	2026-01-22 12:56:01.874088	f
1666	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.281568e+07	1	1.281568e+07	t	2026-01-22 13:57:49.704485	f
1668	4731	4f229366-dbe3-4361-84cb-115cab42685f	2.203689e+07	5	3.415718e+07	t	2026-01-22 14:29:50.94447	f
1671	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	700000	2	875000	t	2026-01-22 14:32:43.519901	f
1674	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.230734e+06	2	1.5384175e+06	t	2026-01-22 15:17:59.739629	f
1684	4715	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	400000	1	400000	f	2026-01-22 15:51:07.200908	f
1708	4649	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	1	400000	f	2026-01-22 17:18:46.201164	f
1713	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.495967e+06	2	1.8699588e+06	f	2026-01-22 18:33:48.864738	f
1714	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.570766e+06	2	1.9634575e+06	t	2026-01-22 18:33:49.309146	f
1755	4671	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.232975e+06	1	1.232975e+06	f	2026-01-22 19:12:22.300287	f
1779	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.696049e+06	1	3.696049e+06	t	2026-01-22 20:27:23.82935	f
1780	4647	51f792dc-04f3-467f-a604-631165c75b38	3.104682e+06	2	3.8808525e+06	t	2026-01-22 20:27:24.257128	f
1781	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.074896e+06	1	4.074896e+06	t	2026-01-22 20:27:24.694938	f
1782	4647	51f792dc-04f3-467f-a604-631165c75b38	3.422913e+06	2	4.278641e+06	t	2026-01-22 20:27:25.06823	f
1783	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.492574e+06	1	4.492574e+06	t	2026-01-22 20:27:25.442921	f
1784	4647	51f792dc-04f3-467f-a604-631165c75b38	3.773763e+06	2	4.717204e+06	t	2026-01-22 20:27:25.820841	f
1837	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.89346e+07	1	1.89346e+07	t	2026-01-22 23:21:26.655603	f
1846	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.937378e+07	1	2.937378e+07	t	2026-01-22 23:21:41.85959	f
1853	4661	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.422294e+06	1	1.422294e+06	f	2026-01-23 01:31:16.215798	f
1870	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.493409e+06	1	1.493409e+06	t	2026-01-23 01:55:53.024238	f
1882	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	703553	1	703553	f	2026-01-23 02:13:31.368076	f
1883	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	590985	2	738731.25	t	2026-01-23 02:13:31.778156	f
1886	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	855176	1	855176	f	2026-01-23 02:13:41.838898	f
1887	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	718348	2	897935	t	2026-01-23 02:13:42.255878	f
1888	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	942832	1	942832	f	2026-01-23 02:13:46.559926	f
1889	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	791979	2	989973.75	t	2026-01-23 02:13:46.957347	f
978	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.728812e+06	3	2.29932e+06	t	2026-01-18 14:37:17.534727	f
985	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.101382e+06	3	2.794838e+06	t	2026-01-18 14:37:47.449363	f
998	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.816057e+06	3	3.7453558e+06	t	2026-01-18 14:39:07.680403	f
1009	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.773787e+06	3	5.0191365e+06	t	2026-01-18 14:41:54.580531	f
1010	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.773789e+06	3	5.0191395e+06	t	2026-01-18 14:41:55.884239	f
1011	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.962479e+06	3	5.270097e+06	t	2026-01-18 14:42:13.883536	f
1017	4509	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.646633e+06	3	4.850022e+06	t	2026-01-18 15:14:00.167572	f
1294	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	950000	1	950000	f	2026-01-20 02:38:43.830702	f
1319	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	668115	2	835143.75	t	2026-01-20 17:35:35.485021	f
1322	4592	51f792dc-04f3-467f-a604-631165c75b38	1.096127e+06	1	1.096127e+06	t	2026-01-20 17:35:36.681374	f
1376	4603	51f792dc-04f3-467f-a604-631165c75b38	5.584444e+06	2	6.980555e+06	t	2026-01-20 22:13:43.012561	f
1377	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.863667e+06	2	7.329584e+06	t	2026-01-20 22:13:43.42164	f
1378	4603	51f792dc-04f3-467f-a604-631165c75b38	6.156851e+06	2	7.696064e+06	t	2026-01-20 22:13:43.811391	f
1379	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	6.464694e+06	2	8.0808675e+06	t	2026-01-20 22:13:44.19821	f
1380	4603	51f792dc-04f3-467f-a604-631165c75b38	6.787929e+06	2	8.484911e+06	t	2026-01-20 22:13:44.56726	f
1381	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	7.127326e+06	2	8.909158e+06	t	2026-01-20 22:13:44.927987	f
1382	4603	51f792dc-04f3-467f-a604-631165c75b38	7.483693e+06	2	9.354616e+06	t	2026-01-20 22:13:45.303917	f
1383	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	7.857878e+06	2	9.822348e+06	t	2026-01-20 22:13:45.659834	f
1413	4598	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	562842	2	703552.5	f	2026-01-20 23:32:48.334271	f
1414	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	2	738731.25	t	2026-01-20 23:32:48.736555	f
1415	4598	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	620535	2	775668.75	f	2026-01-20 23:32:53.174973	f
1453	4601	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.205e+06	1	2.205e+06	f	2026-01-21 02:13:30.248766	f
1454	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.31525e+06	1	2.31525e+06	t	2026-01-21 02:13:30.654693	f
1455	4601	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.431013e+06	1	2.431013e+06	f	2026-01-21 02:13:36.768734	f
1471	4603	51f792dc-04f3-467f-a604-631165c75b38	1.2536085e+07	1	1.2536085e+07	t	2026-01-21 02:26:02.331353	f
1496	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	525000	1	525000	t	2026-01-21 14:08:14.99262	f
1504	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	775668	1	775668	t	2026-01-21 14:08:19.187902	f
1513	4647	51f792dc-04f3-467f-a604-631165c75b38	962657	2	1.2033212e+06	t	2026-01-21 14:09:13.779051	f
1543	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	777000	1	777000	t	2026-01-21 15:18:03.671524	f
1544	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	815850	1	815850	t	2026-01-21 15:18:04.090769	f
1545	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	856643	1	856643	t	2026-01-21 15:18:04.485712	f
1546	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	899476	1	899476	t	2026-01-21 15:18:04.867656	f
1571	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.138351e+06	2	2.6729388e+06	t	2026-01-21 16:25:43.839556	f
1577	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.865599e+06	2	3.5819988e+06	t	2026-01-21 16:25:47.91805	f
1578	4614	51f792dc-04f3-467f-a604-631165c75b38	3.008879e+06	2	3.7610988e+06	t	2026-01-21 16:25:48.588901	f
1580	4614	51f792dc-04f3-467f-a604-631165c75b38	3.31729e+06	2	4.1466125e+06	t	2026-01-21 16:25:49.834366	f
1596	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	562842	1	562842	f	2026-01-22 01:00:57.183248	f
1597	4633	51f792dc-04f3-467f-a604-631165c75b38	590985	1	590985	t	2026-01-22 01:00:57.607191	f
1618	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.354566e+06	1	1.354566e+06	f	2026-01-22 01:48:20.062559	f
1619	4633	51f792dc-04f3-467f-a604-631165c75b38	1.422295e+06	1	1.422295e+06	t	2026-01-22 01:48:20.476836	f
1635	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.091446e+06	1	1.091446e+06	t	2026-01-22 05:59:22.843769	f
1636	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	1.146019e+06	1	1.146019e+06	t	2026-01-22 05:59:23.261858	f
1637	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.20332e+06	1	1.20332e+06	t	2026-01-22 05:59:23.627181	f
1638	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	1.263486e+06	1	1.263486e+06	t	2026-01-22 05:59:23.98477	f
1639	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.326661e+06	1	1.326661e+06	t	2026-01-22 05:59:24.337473	f
1640	4685	6f591686-4009-4693-a2c7-d3eb1b36073f	1.392995e+06	1	1.392995e+06	t	2026-01-22 05:59:24.69458	f
1652	4664	0477609b-080d-4cd2-b891-117e615bdf47	536040	2	670050	t	2026-01-22 12:55:06.683567	f
1660	4664	0477609b-080d-4cd2-b891-117e615bdf47	791979	2	989973.75	f	2026-01-22 12:55:53.871917	f
1685	4719	02538c92-2a46-43e6-8351-33297d6de099	7.610239e+06	3	1.0121618e+07	f	2026-01-22 15:52:22.555584	f
1709	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	408800	1	408800	f	2026-01-22 17:18:54.924511	f
1715	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.01079e+06	2	1.2634875e+06	f	2026-01-22 18:34:32.519914	f
1716	4647	51f792dc-04f3-467f-a604-631165c75b38	1.06133e+06	2	1.3266625e+06	t	2026-01-22 18:34:32.926034	f
1717	4663	e08f4fb4-f7df-4224-9a81-21c0f93cf810	400000	1	400000	f	2026-01-22 18:35:00.4667	f
1756	4671	51f792dc-04f3-467f-a604-631165c75b38	1.035699e+06	2	1.2946238e+06	t	2026-01-22 19:12:23.535236	f
1785	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.49869e+06	1	1.49869e+06	t	2026-01-22 20:28:31.894422	f
1786	4671	51f792dc-04f3-467f-a604-631165c75b38	1.2589e+06	2	1.573625e+06	t	2026-01-22 20:28:32.318176	f
1787	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.652307e+06	1	1.652307e+06	t	2026-01-22 20:28:32.693133	f
1788	4671	51f792dc-04f3-467f-a604-631165c75b38	1.387938e+06	2	1.7349225e+06	t	2026-01-22 20:28:33.060373	f
1789	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.821669e+06	1	1.821669e+06	t	2026-01-22 20:28:33.42201	f
1790	4671	51f792dc-04f3-467f-a604-631165c75b38	1.530202e+06	2	1.9127525e+06	t	2026-01-22 20:28:33.794583	f
1791	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.008391e+06	1	2.008391e+06	t	2026-01-22 20:28:34.165192	f
1792	4671	51f792dc-04f3-467f-a604-631165c75b38	1.687049e+06	2	2.1088112e+06	t	2026-01-22 20:28:34.528532	f
1793	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.214252e+06	1	2.214252e+06	t	2026-01-22 20:28:34.891588	f
1794	4671	51f792dc-04f3-467f-a604-631165c75b38	1.859972e+06	2	2.324965e+06	t	2026-01-22 20:28:35.260864	f
1795	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.441214e+06	1	2.441214e+06	t	2026-01-22 20:28:35.636426	f
1796	4671	51f792dc-04f3-467f-a604-631165c75b38	2.05062e+06	2	2.563275e+06	t	2026-01-22 20:28:36.013417	f
1797	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.691439e+06	1	2.691439e+06	t	2026-01-22 20:28:36.384324	f
1798	4671	51f792dc-04f3-467f-a604-631165c75b38	2.260809e+06	2	2.8260112e+06	t	2026-01-22 20:28:36.752932	f
1799	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.967312e+06	1	2.967312e+06	t	2026-01-22 20:28:37.133986	f
1800	4671	51f792dc-04f3-467f-a604-631165c75b38	2.492543e+06	2	3.1156788e+06	t	2026-01-22 20:28:37.506193	f
1801	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.271463e+06	1	3.271463e+06	t	2026-01-22 20:28:37.874927	f
1802	4671	51f792dc-04f3-467f-a604-631165c75b38	2.748029e+06	2	3.4350362e+06	t	2026-01-22 20:28:38.263707	f
1839	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.0875396e+07	1	2.0875396e+07	t	2026-01-22 23:21:30.085675	f
1840	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.1919166e+07	1	2.1919166e+07	t	2026-01-22 23:21:31.795146	f
1854	4663	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	420000	1	420000	t	2026-01-23 01:34:33.9004	f
980	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.815253e+06	3	2.4142865e+06	t	2026-01-18 14:37:18.912289	f
984	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.001317e+06	3	2.6617515e+06	t	2026-01-18 14:37:46.705533	f
995	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.681958e+06	3	3.5670042e+06	t	2026-01-18 14:38:42.280668	f
1003	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.259938e+06	3	4.3357175e+06	t	2026-01-18 14:40:27.284299	f
1012	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.962479e+06	3	5.270097e+06	t	2026-01-18 14:42:17.180814	f
1295	4592	51f792dc-04f3-467f-a604-631165c75b38	668115	1	668115	t	2026-01-20 02:46:07.716167	f
1320	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	835144	2	1.04393e+06	t	2026-01-20 17:35:35.819838	f
1323	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	920747	2	1.1509338e+06	t	2026-01-20 17:35:37.480194	f
1325	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.015125e+06	2	1.2689062e+06	t	2026-01-20 17:35:41.411839	f
1330	4592	51f792dc-04f3-467f-a604-631165c75b38	1.619484e+06	1	1.619484e+06	t	2026-01-20 17:36:24.4508	f
1336	4660	02538c92-2a46-43e6-8351-33297d6de099	9.764327e+06	2	1.2205409e+07	f	2026-01-20 18:02:37.430182	f
1384	4647	51f792dc-04f3-467f-a604-631165c75b38	400000	2	500000	t	2026-01-20 22:16:42.534203	f
1416	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	525000	1	525000	t	2026-01-20 23:45:48.574483	f
1417	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	441000	2	551250	t	2026-01-20 23:45:48.983222	f
1418	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	578813	1	578813	t	2026-01-20 23:45:49.333544	f
1419	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	486203	2	607753.75	t	2026-01-20 23:45:49.68429	f
1420	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	638142	1	638142	t	2026-01-20 23:45:50.036976	f
1421	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	536040	2	670050	t	2026-01-20 23:45:50.394438	f
1422	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	703553	1	703553	t	2026-01-20 23:45:50.748522	f
1423	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	590985	2	738731.25	t	2026-01-20 23:45:51.103021	f
1424	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	775668	1	775668	t	2026-01-20 23:45:51.455546	f
1425	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	651562	2	814452.5	t	2026-01-20 23:45:51.806628	f
1426	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	855176	1	855176	t	2026-01-20 23:45:52.157887	f
1427	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	718348	2	897935	t	2026-01-20 23:45:52.512202	f
1428	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	942832	1	942832	t	2026-01-20 23:45:52.859542	f
1429	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	791979	2	989973.75	t	2026-01-20 23:45:53.205694	f
1430	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.039473e+06	1	1.039473e+06	t	2026-01-20 23:45:53.562348	f
1431	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	873158	2	1.0914475e+06	t	2026-01-20 23:45:53.918299	f
1432	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.14602e+06	1	1.14602e+06	t	2026-01-20 23:45:54.269497	f
1433	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	962657	2	1.2033212e+06	t	2026-01-20 23:45:54.619173	f
1434	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.263488e+06	1	1.263488e+06	t	2026-01-20 23:45:54.968587	f
1456	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	5.690499e+06	1	5.690499e+06	t	2026-01-21 02:15:29.506217	f
1457	4596	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.975024e+06	1	5.975024e+06	t	2026-01-21 02:15:29.932226	f
1472	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.0530312e+07	2	1.316289e+07	f	2026-01-21 02:26:33.577619	f
1497	4647	51f792dc-04f3-467f-a604-631165c75b38	441000	2	551250	t	2026-01-21 14:08:15.580869	f
1498	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	578813	1	578813	t	2026-01-21 14:08:16.171019	f
1499	4647	51f792dc-04f3-467f-a604-631165c75b38	486203	2	607753.75	t	2026-01-21 14:08:16.687083	f
1512	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.14602e+06	1	1.14602e+06	t	2026-01-21 14:09:13.276535	f
1547	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	463050	1	463050	t	2026-01-21 15:19:01.620976	f
1548	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	1	486203	t	2026-01-21 15:19:02.062689	f
1549	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	510514	1	510514	t	2026-01-21 15:19:02.491354	f
1550	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	1	536040	t	2026-01-21 15:19:02.896883	f
1551	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	562842	1	562842	t	2026-01-21 15:19:03.303248	f
1552	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	1	590985	t	2026-01-21 15:19:03.698523	f
1553	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	620535	1	620535	t	2026-01-21 15:19:04.081831	f
1554	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	651562	1	651562	t	2026-01-21 15:19:04.48695	f
1555	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	684141	1	684141	t	2026-01-21 15:19:04.876949	f
1556	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	718349	1	718349	t	2026-01-21 15:19:05.272054	f
1573	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.357533e+06	2	2.9469162e+06	t	2026-01-21 16:25:45.158146	f
1598	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	620535	1	620535	f	2026-01-22 01:01:05.203246	f
1599	4633	51f792dc-04f3-467f-a604-631165c75b38	651562	1	651562	t	2026-01-22 01:01:05.644105	f
1600	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	684141	1	684141	f	2026-01-22 01:01:12.254087	f
1601	4633	51f792dc-04f3-467f-a604-631165c75b38	718349	1	718349	t	2026-01-22 01:01:12.682373	f
1620	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.49341e+06	1	1.49341e+06	f	2026-01-22 01:48:28.070219	f
1621	4633	51f792dc-04f3-467f-a604-631165c75b38	1.568081e+06	1	1.568081e+06	t	2026-01-22 01:48:28.529347	f
1641	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	755560	2	944450	t	2026-01-22 06:29:31.688447	f
1653	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	703553	1	703553	t	2026-01-22 12:55:07.343696	f
1672	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.116311e+06	2	1.3953888e+06	t	2026-01-22 15:17:30.592298	f
1686	4691	02538c92-2a46-43e6-8351-33297d6de099	2.659937e+06	1	2.659937e+06	f	2026-01-22 15:52:36.67595	f
1710	4642	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	1	400000	f	2026-01-22 17:19:58.884419	f
1718	4666	e08f4fb4-f7df-4224-9a81-21c0f93cf810	429240	1	429240	f	2026-01-22 18:35:58.465748	f
1757	4671	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.359355e+06	1	1.359355e+06	f	2026-01-22 19:12:32.650485	f
1803	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	578813	1	578813	t	2026-01-22 20:29:46.086367	f
1804	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-22 20:29:46.544241	f
1805	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	638142	1	638142	t	2026-01-22 20:29:46.938574	f
1806	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-22 20:29:47.326998	f
1807	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	703553	1	703553	t	2026-01-22 20:29:47.715707	f
1808	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	2	738731.25	t	2026-01-22 20:29:48.109421	f
1809	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	775668	1	775668	t	2026-01-22 20:29:48.494343	f
1810	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	651562	2	814452.5	t	2026-01-22 20:29:48.888461	f
1811	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	855176	1	855176	t	2026-01-22 20:29:49.28111	f
1812	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	718348	2	897935	t	2026-01-22 20:29:49.684882	f
1813	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	942832	1	942832	t	2026-01-22 20:29:50.086418	f
1814	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	791979	2	989973.75	t	2026-01-22 20:29:50.48027	f
1815	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.039473e+06	1	1.039473e+06	t	2026-01-22 20:29:50.876408	f
981	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.906015e+06	3	2.535e+06	t	2026-01-18 14:37:31.079641	f
983	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.001316e+06	3	2.6617502e+06	t	2026-01-18 14:37:46.557181	f
990	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.316776e+06	3	3.081312e+06	t	2026-01-18 14:37:50.020177	f
1000	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.95686e+06	3	3.9326238e+06	t	2026-01-18 14:39:28.080309	f
1002	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.104703e+06	3	4.129255e+06	t	2026-01-18 14:40:10.384145	f
1006	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.422937e+06	3	4.552506e+06	t	2026-01-18 14:40:56.981159	f
1008	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.594084e+06	3	4.7801315e+06	t	2026-01-18 14:41:17.982259	f
1018	4509	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.074019e+06	2	5.092524e+06	f	2026-01-18 15:14:22.346672	f
1296	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-20 02:52:48.417822	f
1321	4592	51f792dc-04f3-467f-a604-631165c75b38	876901	1	876901	t	2026-01-20 17:35:36.263306	f
1385	4633	51f792dc-04f3-467f-a604-631165c75b38	400000	1	400000	t	2026-01-20 22:22:30.301908	f
1435	4598	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	814453	1	814453	t	2026-01-20 23:46:10.542475	f
1458	4633	5d77ac22-c768-4d3b-99d8-73c250a3e859	420000	1	420000	f	2026-01-21 02:15:49.672933	f
1459	4633	51f792dc-04f3-467f-a604-631165c75b38	441000	1	441000	t	2026-01-21 02:15:50.08822	f
1473	4601	51f792dc-04f3-467f-a604-631165c75b38	2.552564e+06	1	2.552564e+06	t	2026-01-21 02:27:13.596171	f
1500	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	638142	1	638142	t	2026-01-21 14:08:17.195035	f
1502	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	703553	1	703553	t	2026-01-21 14:08:18.190608	f
1515	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	400000	1	400000	t	2026-01-21 14:11:12.356921	f
1557	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	754267	1	754267	t	2026-01-21 15:19:27.149785	f
1583	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.83745e+06	2	3.5468125e+06	t	2026-01-21 19:10:01.337389	f
1585	4624	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.840916e+06	4	8.35251e+06	t	2026-01-21 19:59:51.421481	f
1602	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	754267	1	754267	f	2026-01-22 01:01:22.69917	f
1603	4633	51f792dc-04f3-467f-a604-631165c75b38	791981	1	791981	t	2026-01-22 01:01:23.156851	f
1622	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.646486e+06	1	1.646486e+06	f	2026-01-22 01:52:45.191736	f
1623	4633	51f792dc-04f3-467f-a604-631165c75b38	1.728811e+06	1	1.728811e+06	t	2026-01-22 01:52:45.625265	f
1642	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	991673	1	991673	t	2026-01-22 06:29:32.273012	f
1644	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.093321e+06	1	1.093321e+06	t	2026-01-22 06:29:33.404019	f
1656	4664	0477609b-080d-4cd2-b891-117e615bdf47	651562	2	814452.5	f	2026-01-22 12:55:27.236881	f
1658	4664	0477609b-080d-4cd2-b891-117e615bdf47	718348	2	897935	f	2026-01-22 12:55:42.962707	f
1661	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.039473e+06	1	1.039473e+06	t	2026-01-22 12:55:54.657148	f
1664	4664	0477609b-080d-4cd2-b891-117e615bdf47	962657	2	1.2033212e+06	f	2026-01-22 12:56:08.525948	f
1687	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	420000	1	420000	t	2026-01-22 16:07:55.166121	f
1690	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	486203	1	486203	t	2026-01-22 16:07:56.9361	f
1698	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	718349	1	718349	t	2026-01-22 16:08:01.015145	f
1711	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	f	2026-01-22 17:21:37.267958	f
1719	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.118344e+06	1	1.118344e+06	f	2026-01-22 18:36:11.271812	f
1720	4671	51f792dc-04f3-467f-a604-631165c75b38	939409	2	1.1742612e+06	t	2026-01-22 18:36:11.737233	f
1758	4671	51f792dc-04f3-467f-a604-631165c75b38	1.141859e+06	2	1.4273238e+06	t	2026-01-22 19:12:33.730189	f
1816	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	873158	2	1.0914475e+06	t	2026-01-22 20:29:51.268289	f
1817	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.14602e+06	1	1.14602e+06	t	2026-01-22 20:29:51.65546	f
1818	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	962657	2	1.2033212e+06	t	2026-01-22 20:29:52.04595	f
1819	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.263488e+06	1	1.263488e+06	t	2026-01-22 20:29:52.443526	f
1841	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.3015124e+07	1	2.3015124e+07	t	2026-01-22 23:21:33.4363	f
1843	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.5374174e+07	1	2.5374174e+07	t	2026-01-22 23:21:36.948263	f
1844	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.6642884e+07	1	2.6642884e+07	t	2026-01-22 23:21:38.609362	f
1855	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.263488e+06	1	1.263488e+06	t	2026-01-23 01:43:27.827436	f
1871	4659	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.68041e+07	2	2.1005124e+07	f	2026-01-23 01:58:56.753649	f
1884	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	775668	1	775668	f	2026-01-23 02:13:36.806356	f
1885	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	651562	2	814452.5	t	2026-01-23 02:13:37.238136	f
1890	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.039473e+06	1	1.039473e+06	f	2026-01-23 02:13:52.760638	f
1891	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	873158	2	1.0914475e+06	t	2026-01-23 02:13:53.172885	f
1892	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.14602e+06	1	1.14602e+06	f	2026-01-23 02:13:57.774503	f
1893	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	962657	2	1.2033212e+06	t	2026-01-23 02:13:58.206218	f
1896	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.392996e+06	1	1.392996e+06	f	2026-01-23 02:14:07.503044	f
1897	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.170117e+06	2	1.4626462e+06	t	2026-01-23 02:14:07.911531	f
1898	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.535779e+06	1	1.535779e+06	f	2026-01-23 02:14:12.857362	f
1899	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.290055e+06	2	1.6125688e+06	t	2026-01-23 02:14:13.266206	f
1907	4666	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	473238	1	473238	f	2026-01-23 02:24:34.478199	f
1908	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	496900	1	496900	t	2026-01-23 02:24:34.920067	f
1922	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-23 03:13:11.449247	f
1934	4688	0477609b-080d-4cd2-b891-117e615bdf47	651562	2	814452.5	f	2026-01-23 04:02:14.405321	f
1935	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	855176	1	855176	t	2026-01-23 04:02:14.819777	f
1951	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.192781e+06	1	3.192781e+06	t	2026-01-23 05:21:53.861846	f
1955	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.880849e+06	1	3.880849e+06	t	2026-01-23 05:21:57.078881	f
1960	4748	51f792dc-04f3-467f-a604-631165c75b38	400000	1	400000	t	2026-01-23 14:04:35.278701	f
1963	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	598124	4	855317.3	t	2026-01-23 14:20:48.561095	f
1970	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.568072e+06	2	1.96009e+06	t	2026-01-23 18:49:40.426865	f
1975	4691	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	8.578588e+06	1	8.578588e+06	t	2026-01-23 19:49:28.688535	f
1982	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	400000	2	500000	t	2026-01-23 21:44:18.517547	f
1999	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.200711e+06	1	5.200711e+06	t	2026-01-23 22:16:25.493608	f
2000	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	5.460747e+06	1	5.460747e+06	t	2026-01-23 22:16:25.921679	f
2021	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.250896e+06	2	2.81362e+06	t	2026-01-23 22:39:07.842675	f
2024	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	9.007518e+06	1	9.007518e+06	t	2026-01-23 22:40:23.608674	f
2026	4685	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	5.733785e+06	1	5.733785e+06	f	2026-01-24 00:43:09.442487	f
2028	4731	4f229366-dbe3-4361-84cb-115cab42685f	2.4295672e+07	5	3.7658292e+07	f	2026-01-24 00:45:53.178223	f
982	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.906016e+06	3	2.5350012e+06	t	2026-01-18 14:37:33.380465	f
989	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.316775e+06	3	3.0813108e+06	t	2026-01-18 14:37:49.901093	f
991	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.432614e+06	3	3.2353765e+06	t	2026-01-18 14:37:50.489022	f
992	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.432615e+06	3	3.235378e+06	t	2026-01-18 14:37:51.280393	f
997	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.816056e+06	3	3.7453545e+06	t	2026-01-18 14:39:03.381596	f
1297	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.280313e+06	2	1.6003912e+06	t	2026-01-20 02:54:02.103691	f
1324	4592	51f792dc-04f3-467f-a604-631165c75b38	1.208481e+06	1	1.208481e+06	t	2026-01-20 17:35:40.531672	f
1329	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.233892e+06	2	1.542365e+06	t	2026-01-20 17:36:11.148736	f
1331	4592	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.360367e+06	2	1.7004588e+06	t	2026-01-20 17:36:39.350673	f
1386	4600	51f792dc-04f3-467f-a604-631165c75b38	400000	1	400000	t	2026-01-20 22:28:21.433849	f
1436	4601	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.7e+06	1	1.7e+06	f	2026-01-20 23:56:30.276928	f
1437	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.785e+06	1	1.785e+06	t	2026-01-20 23:56:30.714014	f
1438	4601	5d77ac22-c768-4d3b-99d8-73c250a3e859	2e+06	1	2e+06	f	2026-01-20 23:56:43.763595	f
1439	4601	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.1e+06	1	2.1e+06	t	2026-01-20 23:56:44.189608	f
1460	4633	5d77ac22-c768-4d3b-99d8-73c250a3e859	463050	1	463050	f	2026-01-21 02:16:06.629786	f
1461	4633	51f792dc-04f3-467f-a604-631165c75b38	486203	1	486203	t	2026-01-21 02:16:07.088199	f
1474	4603	51f792dc-04f3-467f-a604-631165c75b38	1.3821035e+07	1	1.3821035e+07	t	2026-01-21 02:28:07.88332	f
1501	4647	51f792dc-04f3-467f-a604-631165c75b38	536040	2	670050	t	2026-01-21 14:08:17.703251	f
1507	4647	51f792dc-04f3-467f-a604-631165c75b38	718348	2	897935	t	2026-01-21 14:08:20.697903	f
1511	4647	51f792dc-04f3-467f-a604-631165c75b38	873158	2	1.0914475e+06	t	2026-01-21 14:09:12.786786	f
1558	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	633585	2	791981.25	t	2026-01-21 15:38:04.159532	f
1559	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	831581	1	831581	t	2026-01-21 15:38:04.577525	f
1560	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	698529	2	873161.25	t	2026-01-21 15:38:04.947106	f
1561	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	916820	1	916820	t	2026-01-21 15:38:05.297482	f
1562	4612	f335b9c3-7d63-44f3-9540-13b1d461ca13	770129	2	962661.25	t	2026-01-21 15:38:05.659868	f
1584	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.724154e+06	1	3.724154e+06	t	2026-01-21 19:10:02.657879	f
1604	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	831581	1	831581	f	2026-01-22 01:01:45.115626	f
1605	4633	51f792dc-04f3-467f-a604-631165c75b38	873161	1	873161	t	2026-01-22 01:01:45.518988	f
1606	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	916820	1	916820	f	2026-01-22 01:01:50.365316	f
1607	4633	51f792dc-04f3-467f-a604-631165c75b38	962661	1	962661	t	2026-01-22 01:01:50.766519	f
1624	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.240263e+06	1	5.240263e+06	t	2026-01-22 01:58:44.14501	f
1643	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	833006	2	1.0412575e+06	t	2026-01-22 06:29:32.845398	f
1659	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	942832	1	942832	t	2026-01-22 12:55:43.753964	f
1673	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.172127e+06	2	1.4651588e+06	t	2026-01-22 15:17:31.136355	f
1688	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	441000	1	441000	t	2026-01-22 16:07:55.805558	f
1696	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	651562	1	651562	t	2026-01-22 16:07:59.978382	f
1721	4676	e08f4fb4-f7df-4224-9a81-21c0f93cf810	525000	1	525000	f	2026-01-22 18:36:22.301081	f
1759	4686	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	t	2026-01-22 19:28:46.671366	f
1760	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	849068	2	1.061335e+06	t	2026-01-22 19:28:58.772565	f
1761	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.114402e+06	1	1.114402e+06	t	2026-01-22 19:28:59.256488	f
1762	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	936098	2	1.1701225e+06	t	2026-01-22 19:28:59.661319	f
1763	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.228629e+06	1	1.228629e+06	t	2026-01-22 19:29:00.050168	f
1764	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.032049e+06	2	1.2900612e+06	t	2026-01-22 19:29:00.461849	f
1820	4660	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.635642e+07	1	1.635642e+07	t	2026-01-22 20:30:36.095292	f
1821	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.717424e+07	1	1.717424e+07	t	2026-01-22 20:30:36.54682	f
1842	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.416588e+07	1	2.416588e+07	t	2026-01-22 23:21:35.245735	f
1856	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.06133e+06	2	1.3266625e+06	f	2026-01-23 01:44:40.471102	f
1857	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.392996e+06	1	1.392996e+06	t	2026-01-23 01:44:40.880332	f
1858	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.170117e+06	2	1.4626462e+06	f	2026-01-23 01:44:53.420795	f
1859	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.535779e+06	1	1.535779e+06	t	2026-01-23 01:44:53.908788	f
1872	4729	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.3311673e+07	3	1.7704526e+07	t	2026-01-23 02:03:05.932026	f
1894	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.263488e+06	1	1.263488e+06	f	2026-01-23 02:14:02.983791	f
1895	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.06133e+06	2	1.3266625e+06	t	2026-01-23 02:14:03.419413	f
1909	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.8589752e+07	1	1.8589752e+07	t	2026-01-23 02:24:53.959631	f
1911	4729	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.467612e+07	3	1.951924e+07	t	2026-01-23 02:24:54.383166	f
1912	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.0495202e+07	1	2.0495202e+07	t	2026-01-23 02:24:54.752511	f
1923	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	713152	1	713152	t	2026-01-23 03:15:44.269273	f
1936	4688	0477609b-080d-4cd2-b891-117e615bdf47	718348	2	897935	f	2026-01-23 04:02:20.958687	f
1937	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	942832	1	942832	t	2026-01-23 04:02:21.378067	f
1952	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.352421e+06	1	3.352421e+06	t	2026-01-23 05:21:54.818267	f
1953	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.520043e+06	1	3.520043e+06	t	2026-01-23 05:21:55.635597	f
1961	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	400000	1	400000	t	2026-01-23 14:14:38.457975	f
1971	4691	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	7.057623e+06	1	7.057623e+06	t	2026-01-23 19:49:26.701826	f
1976	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	2.058095e+06	1	2.058095e+06	f	2026-01-23 19:53:57.050422	f
1977	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.7288e+06	2	2.161e+06	t	2026-01-23 19:53:57.468963	f
1983	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	628031	4	898084.3	t	2026-01-23 21:54:09.39587	f
1984	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	659433	4	942989.2	t	2026-01-23 21:54:09.822341	f
1985	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	692405	4	990139.1	t	2026-01-23 21:54:10.199395	f
1986	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	727026	4	1.0396472e+06	t	2026-01-23 21:54:10.600529	f
1987	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	763378	4	1.0916305e+06	t	2026-01-23 21:54:10.967718	f
1988	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	801547	4	1.1462122e+06	t	2026-01-23 21:54:11.338955	f
1989	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	841625	4	1.2035238e+06	t	2026-01-23 21:54:11.741958	f
1990	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	883707	4	1.263701e+06	t	2026-01-23 21:54:12.108855	f
1991	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	927893	4	1.326887e+06	t	2026-01-23 21:54:12.507833	f
1992	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	974288	4	1.3932319e+06	t	2026-01-23 21:54:12.890818	f
986	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.101383e+06	3	2.7948395e+06	t	2026-01-18 14:37:47.638223	f
1298	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.680411e+06	1	1.680411e+06	t	2026-01-20 03:42:13.773035	f
1299	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.411546e+06	2	1.7644325e+06	t	2026-01-20 03:42:14.179951	f
1300	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.852655e+06	1	1.852655e+06	t	2026-01-20 03:42:14.527573	f
1301	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.556231e+06	2	1.9452888e+06	t	2026-01-20 03:42:14.871475	f
1302	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	2.042554e+06	1	2.042554e+06	t	2026-01-20 03:42:15.219009	f
1303	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.715746e+06	2	2.1446825e+06	t	2026-01-20 03:42:15.565324	f
1304	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	2.251917e+06	1	2.251917e+06	t	2026-01-20 03:42:15.919755	f
1305	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.891611e+06	2	2.3645138e+06	t	2026-01-20 03:42:16.26569	f
1306	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	2.48274e+06	1	2.48274e+06	t	2026-01-20 03:42:16.625013	f
1307	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.085502e+06	2	2.6068775e+06	t	2026-01-20 03:42:16.969662	f
1308	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	2.737222e+06	1	2.737222e+06	t	2026-01-20 03:42:17.314117	f
1326	4592	51f792dc-04f3-467f-a604-631165c75b38	1.332352e+06	1	1.332352e+06	t	2026-01-20 17:35:42.379132	f
1337	4659	02538c92-2a46-43e6-8351-33297d6de099	1.68041e+07	1	1.68041e+07	f	2026-01-20 18:02:47.588175	f
1387	4624	6f591686-4009-4693-a2c7-d3eb1b36073f	5.69622e+06	3	7.5759725e+06	t	2026-01-20 22:42:50.208898	f
1440	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	7.100001e+06	3	9.443001e+06	f	2026-01-21 01:06:40.276955	f
1462	4633	5d77ac22-c768-4d3b-99d8-73c250a3e859	510514	1	510514	f	2026-01-21 02:16:13.038934	f
1463	4633	51f792dc-04f3-467f-a604-631165c75b38	536040	1	536040	t	2026-01-21 02:16:13.521837	f
1475	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.160967e+07	2	1.4512088e+07	f	2026-01-21 02:29:12.468162	f
1505	4647	51f792dc-04f3-467f-a604-631165c75b38	651562	2	814452.5	t	2026-01-21 14:08:19.708079	f
1563	4694	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-21 15:48:23.162718	f
1586	4656	e2831203-b5bb-4911-9a98-485fe4c6e3b5	400000	1	400000	t	2026-01-21 20:01:00.769021	f
1608	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.010795e+06	1	1.010795e+06	f	2026-01-22 01:07:29.2778	f
1609	4633	51f792dc-04f3-467f-a604-631165c75b38	1.061335e+06	1	1.061335e+06	t	2026-01-22 01:07:29.713905	f
1625	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.815252e+06	1	1.815252e+06	f	2026-01-22 02:00:46.989629	f
1626	4633	51f792dc-04f3-467f-a604-631165c75b38	1.906015e+06	1	1.906015e+06	t	2026-01-22 02:00:47.415356	f
1645	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	918390	2	1.1479875e+06	t	2026-01-22 06:29:33.88004	f
1669	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.322322e+06	2	4.1529025e+06	t	2026-01-22 14:30:32.943519	f
1670	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.322322e+06	2	4.1529025e+06	t	2026-01-22 14:30:33.00355	f
1675	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.292271e+06	2	1.6153388e+06	t	2026-01-22 15:18:00.303991	f
1689	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	463050	1	463050	t	2026-01-22 16:07:56.378559	f
1691	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	510514	1	510514	t	2026-01-22 16:07:57.475162	f
1700	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	791981	1	791981	t	2026-01-22 16:08:01.955049	f
1702	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	873161	1	873161	t	2026-01-22 16:09:59.814253	f
1703	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	916820	1	916820	t	2026-01-22 16:10:00.309174	f
1705	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.010795e+06	1	1.010795e+06	t	2026-01-22 16:10:23.862693	f
1722	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	528987	3	703552.7	t	2026-01-22 18:37:25.768778	f
1723	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	590985	2	738731.25	t	2026-01-22 18:37:26.21357	f
1724	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	583209	3	775668	t	2026-01-22 18:37:26.583662	f
1765	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.932581e+06	1	2.932581e+06	t	2026-01-22 19:38:50.358433	f
1766	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.079211e+06	1	3.079211e+06	t	2026-01-22 19:38:50.757253	f
1767	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.233172e+06	1	3.233172e+06	t	2026-01-22 19:38:51.130205	f
1768	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.394831e+06	1	3.394831e+06	t	2026-01-22 19:38:51.520319	f
1822	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.612567e+06	1	1.612567e+06	t	2026-01-22 20:33:57.105285	f
1823	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.693196e+06	1	1.693196e+06	t	2026-01-22 20:33:57.519825	f
1824	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.777856e+06	1	1.777856e+06	t	2026-01-22 20:33:57.943174	f
1825	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.866749e+06	1	1.866749e+06	t	2026-01-22 20:33:58.334043	f
1826	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.960087e+06	1	1.960087e+06	t	2026-01-22 20:33:58.694776	f
1827	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.058092e+06	1	2.058092e+06	t	2026-01-22 20:33:59.053843	f
1828	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.160997e+06	1	2.160997e+06	t	2026-01-22 20:33:59.420423	f
1845	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.7975028e+07	1	2.7975028e+07	t	2026-01-22 23:21:40.29435	f
1860	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.290055e+06	2	1.6125688e+06	f	2026-01-23 01:45:00.864529	f
1861	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.693198e+06	1	1.693198e+06	t	2026-01-23 01:45:01.281604	f
1873	4648	c532b6f7-bdfb-4505-b43f-f653770c03af	400000	1	400000	f	2026-01-23 02:08:22.339341	f
1901	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.693198e+06	1	1.693198e+06	f	2026-01-23 02:14:45.864326	f
1902	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.422287e+06	2	1.7778588e+06	t	2026-01-23 02:14:46.262658	f
1903	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	1.866752e+06	1	1.866752e+06	f	2026-01-23 02:14:50.921111	f
1910	4666	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	521745	1	521745	f	2026-01-23 02:24:54.364299	f
1913	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	547833	1	547833	t	2026-01-23 02:24:54.806883	f
1924	4688	0477609b-080d-4cd2-b891-117e615bdf47	400000	2	500000	f	2026-01-23 04:01:32.227358	f
1925	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	525000	1	525000	t	2026-01-23 04:01:32.677242	f
1938	4688	0477609b-080d-4cd2-b891-117e615bdf47	791979	2	989973.75	f	2026-01-23 04:02:26.084432	f
1954	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.696046e+06	1	3.696046e+06	t	2026-01-23 05:21:56.353319	f
1962	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	400000	1	400000	f	2026-01-23 14:19:04.485511	f
1972	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	7.410505e+06	1	7.410505e+06	t	2026-01-23 19:49:27.258964	f
1978	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	2.26905e+06	1	2.26905e+06	f	2026-01-23 19:54:13.265174	f
1979	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.906002e+06	2	2.3825025e+06	t	2026-01-23 19:54:13.694834	f
1993	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	1.023003e+06	4	1.4628942e+06	f	2026-01-23 21:55:20.477325	f
1994	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.074154e+06	4	1.5360402e+06	t	2026-01-23 21:55:20.897116	f
2001	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	2e+06	5	3.1e+06	f	2026-01-23 22:23:26.875252	f
2002	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.276224e+06	4	3.2550002e+06	t	2026-01-23 22:23:27.304132	f
2022	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.954301e+06	1	2.954301e+06	t	2026-01-23 22:39:08.344179	f
2023	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.481613e+06	2	3.1020162e+06	t	2026-01-23 22:39:08.831042	f
2025	4731	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.3138736e+07	5	3.586504e+07	t	2026-01-24 00:04:02.119801	f
2027	4756	02538c92-2a46-43e6-8351-33297d6de099	3.262117e+06	1	3.262117e+06	f	2026-01-24 00:43:11.260675	f
987	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.206452e+06	3	2.9345812e+06	t	2026-01-18 14:37:48.015166	f
993	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.554245e+06	3	3.3971458e+06	t	2026-01-18 14:38:05.382133	f
1005	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.422935e+06	3	4.5525035e+06	t	2026-01-18 14:40:50.082429	f
1019	4509	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.020414e+06	3	5.3471505e+06	t	2026-01-18 15:14:23.819522	f
1309	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	6.470592e+06	3	8.605887e+06	t	2026-01-20 03:43:06.798339	f
1340	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	798000	2	997500	t	2026-01-20 18:43:37.500221	f
1341	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.047375e+06	1	1.047375e+06	t	2026-01-20 18:43:37.918008	f
1342	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	879795	2	1.0997438e+06	t	2026-01-20 18:43:38.265711	f
1343	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.154731e+06	1	1.154731e+06	t	2026-01-20 18:43:38.616765	f
1344	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	969975	2	1.2124688e+06	t	2026-01-20 18:43:38.987156	f
1347	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.403587e+06	1	1.403587e+06	t	2026-01-20 18:43:40.232157	f
1348	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.179014e+06	2	1.4737675e+06	t	2026-01-20 18:43:40.597141	f
1349	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.547456e+06	1	1.547456e+06	t	2026-01-20 18:43:40.955034	f
1350	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.299864e+06	2	1.62483e+06	t	2026-01-20 18:43:41.305544	f
1351	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.706072e+06	1	1.706072e+06	t	2026-01-20 18:43:41.646917	f
1352	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.433101e+06	2	1.7913762e+06	t	2026-01-20 18:43:41.993613	f
1353	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.880946e+06	1	1.880946e+06	t	2026-01-20 18:43:42.337831	f
1354	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.579995e+06	2	1.9749938e+06	t	2026-01-20 18:43:42.697492	f
1355	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.073744e+06	1	2.073744e+06	t	2026-01-20 18:43:43.040685	f
1356	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.741945e+06	2	2.1774312e+06	t	2026-01-20 18:43:43.3972	f
1357	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.286303e+06	1	2.286303e+06	t	2026-01-20 18:43:43.739926	f
1358	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.920495e+06	2	2.4006188e+06	t	2026-01-20 18:43:44.109293	f
1359	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.52065e+06	1	2.52065e+06	t	2026-01-20 18:43:44.455901	f
1360	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.117346e+06	2	2.6466825e+06	t	2026-01-20 18:43:44.800109	f
1388	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	7.116028e+06	5	1.1029843e+07	t	2026-01-20 23:28:59.20661	f
1389	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	7.47183e+06	5	1.1581336e+07	t	2026-01-20 23:28:59.619998	f
1390	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	7.845422e+06	5	1.2160404e+07	t	2026-01-20 23:28:59.975897	f
1391	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	8.237694e+06	5	1.2768426e+07	t	2026-01-20 23:29:00.327096	f
1392	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	8.649579e+06	5	1.3406847e+07	t	2026-01-20 23:29:00.680213	f
1393	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	9.082058e+06	5	1.407719e+07	t	2026-01-20 23:29:01.035443	f
1394	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	9.536161e+06	5	1.478105e+07	t	2026-01-20 23:29:01.391697	f
1395	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.001297e+07	5	1.5520104e+07	t	2026-01-20 23:29:01.743869	f
1396	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.0513619e+07	5	1.6296109e+07	t	2026-01-20 23:29:02.10102	f
1397	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.10393e+07	5	1.7110916e+07	t	2026-01-20 23:29:02.460657	f
1398	4590	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.1591266e+07	5	1.7966462e+07	t	2026-01-20 23:29:02.817105	f
1399	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.217083e+07	5	1.8864786e+07	t	2026-01-20 23:29:03.196114	f
1441	4596	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	4.246335e+06	1	4.246335e+06	f	2026-01-21 01:22:29.681463	f
1442	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	4.458652e+06	1	4.458652e+06	t	2026-01-21 01:22:30.080378	f
1464	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	6.273776e+06	1	6.273776e+06	t	2026-01-21 02:16:55.634469	f
1476	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	932950	2	1.1661875e+06	t	2026-01-21 03:49:25.165794	f
1477	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	979598	2	1.2244975e+06	t	2026-01-21 03:49:25.573866	f
1478	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.028578e+06	2	1.2857225e+06	t	2026-01-21 03:49:25.9469	f
1479	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.080007e+06	2	1.3500088e+06	t	2026-01-21 03:49:26.300248	f
1480	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.134008e+06	2	1.41751e+06	t	2026-01-21 03:49:26.661536	f
1481	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.190709e+06	2	1.4883862e+06	t	2026-01-21 03:49:27.030663	f
1482	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.250245e+06	2	1.5628062e+06	t	2026-01-21 03:49:27.384963	f
1483	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.312758e+06	2	1.6409475e+06	t	2026-01-21 03:49:27.740626	f
1484	4614	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.378396e+06	2	1.722995e+06	t	2026-01-21 03:49:28.088153	f
1485	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.447316e+06	2	1.809145e+06	t	2026-01-21 03:49:28.442745	f
1506	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	855176	1	855176	t	2026-01-21 14:08:20.176795	f
1514	4685	f335b9c3-7d63-44f3-9540-13b1d461ca13	500000	1	500000	t	2026-01-21 14:10:21.388324	f
1564	4614	51f792dc-04f3-467f-a604-631165c75b38	1.519682e+06	2	1.8996025e+06	t	2026-01-21 16:25:38.661075	f
1579	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.159323e+06	2	3.9491538e+06	t	2026-01-21 16:25:49.228299	f
1587	4606	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	400000	1	400000	f	2026-01-21 20:15:32.773	f
1610	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	525000	1	525000	t	2026-01-22 01:12:18.786364	f
1627	4616	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	400000	1	400000	f	2026-01-22 02:04:57.525516	f
1646	4639	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.205387e+06	1	1.205387e+06	t	2026-01-22 06:29:34.412468	f
1676	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.356885e+06	2	1.6961062e+06	t	2026-01-22 15:18:22.991426	f
1677	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.42473e+06	2	1.7809125e+06	t	2026-01-22 15:18:23.45498	f
1692	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	536040	1	536040	t	2026-01-22 16:07:57.982816	f
1704	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	962661	1	962661	t	2026-01-22 16:10:00.804219	f
1725	4676	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-22 18:40:30.974618	f
1769	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.564573e+06	1	3.564573e+06	t	2026-01-22 19:39:57.508596	f
1770	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.742802e+06	1	3.742802e+06	t	2026-01-22 19:39:57.932634	f
1829	4685	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.269047e+06	1	2.269047e+06	f	2026-01-22 20:52:21.559359	f
1830	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.3825e+06	1	2.3825e+06	t	2026-01-22 20:52:21.965621	f
1833	4685	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.206434e+06	2	2.7580425e+06	f	2026-01-22 20:52:53.765208	f
1834	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.895945e+06	1	2.895945e+06	t	2026-01-22 20:52:54.177375	f
1848	4653	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	400000	1	400000	t	2026-01-23 00:34:25.16241	f
1862	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.422287e+06	2	1.7778588e+06	f	2026-01-23 01:45:06.793549	f
1863	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1.866752e+06	1	1.866752e+06	t	2026-01-23 01:45:07.220643	f
1864	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.568072e+06	2	1.96009e+06	f	2026-01-23 01:45:12.992754	f
1865	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.058095e+06	1	2.058095e+06	t	2026-01-23 01:45:13.413526	f
1874	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	420000	1	420000	f	2026-01-23 02:11:03.631394	f
1875	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	2	500000	t	2026-01-23 02:11:04.073622	f
994	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	2.554246e+06	3	3.3971472e+06	t	2026-01-18 14:38:09.180028	f
996	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.681959e+06	3	3.5670055e+06	t	2026-01-18 14:38:45.481282	f
1016	4509	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.619068e+06	1	4.619068e+06	f	2026-01-18 15:13:58.637437	f
1310	4593	02538c92-2a46-43e6-8351-33297d6de099	6.794122e+06	3	9.036182e+06	f	2026-01-20 04:15:35.3598	f
1311	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	7.133828e+06	3	9.487991e+06	t	2026-01-20 04:15:35.75828	f
1345	4611	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.273093e+06	1	1.273093e+06	t	2026-01-20 18:43:39.495577	f
1400	4601	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	400000	2	500000	t	2026-01-20 23:30:17.563181	f
1443	4596	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	4.681585e+06	1	4.681585e+06	f	2026-01-21 01:22:41.296738	f
1444	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	4.915665e+06	1	4.915665e+06	t	2026-01-21 01:22:41.73302	f
1465	4612	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-21 02:19:48.721261	f
1486	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.779017e+06	1	2.779017e+06	t	2026-01-21 06:23:37.209612	f
1508	4647	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	942832	1	942832	t	2026-01-21 14:08:21.20085	f
1565	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.595667e+06	2	1.9945838e+06	t	2026-01-21 16:25:39.465253	f
1575	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.599181e+06	2	3.2489762e+06	t	2026-01-21 16:25:46.599834	f
1581	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.483155e+06	2	4.353944e+06	t	2026-01-21 16:25:50.407457	f
1588	4664	0477609b-080d-4cd2-b891-117e615bdf47	400000	2	500000	f	2026-01-21 20:21:44.807094	f
1611	4612	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.010795e+06	1	1.010795e+06	t	2026-01-22 01:33:43.047657	f
1628	4671	51f792dc-04f3-467f-a604-631165c75b38	701000	2	876250	t	2026-01-22 02:36:02.326106	f
1629	4671	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	920063	1	920063	t	2026-01-22 02:36:02.776169	f
1630	4671	51f792dc-04f3-467f-a604-631165c75b38	772853	2	966066.25	t	2026-01-22 02:36:03.182286	f
1631	4671	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.01437e+06	1	1.01437e+06	t	2026-01-22 02:36:03.600262	f
1632	4671	51f792dc-04f3-467f-a604-631165c75b38	852071	2	1.0650888e+06	t	2026-01-22 02:36:03.997305	f
1647	4639	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.012526e+06	2	1.2656575e+06	t	2026-01-22 06:34:40.569633	f
1693	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	562842	1	562842	t	2026-01-22 16:07:58.511777	f
1695	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	620535	1	620535	t	2026-01-22 16:07:59.522433	f
1726	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.061631e+06	1	2.061631e+06	t	2026-01-22 18:41:39.652579	f
1727	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.731771e+06	2	2.1647138e+06	t	2026-01-22 18:41:40.072776	f
1728	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.27295e+06	1	2.27295e+06	t	2026-01-22 18:41:40.47813	f
1729	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	1.909278e+06	2	2.3865975e+06	t	2026-01-22 18:41:40.844813	f
1730	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.505928e+06	1	2.505928e+06	t	2026-01-22 18:41:41.219033	f
1731	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	2.10498e+06	2	2.631225e+06	t	2026-01-22 18:41:41.593773	f
1732	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.762787e+06	1	2.762787e+06	t	2026-01-22 18:41:41.970049	f
1733	4639	cc78d40c-9179-4616-9834-9aa9c69963fa	2.320742e+06	2	2.9009275e+06	t	2026-01-22 18:41:42.336599	f
1734	4639	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.045974e+06	1	3.045974e+06	t	2026-01-22 18:41:42.695781	f
1771	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.535778e+06	1	1.535778e+06	t	2026-01-22 19:43:12.341309	f
1831	4685	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.0013e+06	2	2.501625e+06	f	2026-01-22 20:52:40.016234	f
1832	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.626707e+06	1	2.626707e+06	t	2026-01-22 20:52:40.461704	f
1838	4660	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.988133e+07	1	1.988133e+07	t	2026-01-22 23:21:28.413058	f
1849	4671	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.787129e+06	1	3.787129e+06	t	2026-01-23 00:37:21.271278	f
1866	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.7288e+06	2	2.161e+06	f	2026-01-23 01:45:20.096586	f
1867	4664	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2.26905e+06	1	2.26905e+06	t	2026-01-23 01:45:20.51476	f
1876	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	525000	1	525000	f	2026-01-23 02:13:13.216235	f
1877	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	441000	2	551250	t	2026-01-23 02:13:13.636863	f
1904	4659	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.852652e+07	2	2.3158152e+07	f	2026-01-23 02:16:34.606389	f
1914	4666	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	575225	1	575225	f	2026-01-23 02:25:52.66548	f
1915	4666	f335b9c3-7d63-44f3-9540-13b1d461ca13	603987	1	603987	t	2026-01-23 02:25:53.100571	f
1926	4688	0477609b-080d-4cd2-b891-117e615bdf47	441000	2	551250	f	2026-01-23 04:01:46.41758	f
1927	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	578813	1	578813	t	2026-01-23 04:01:46.848835	f
1939	4694	4f229366-dbe3-4361-84cb-115cab42685f	400000	5	620000	f	2026-01-23 04:14:13.482112	f
1940	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	520800	2	651000	t	2026-01-23 04:14:13.89617	f
1956	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.074892e+06	1	4.074892e+06	t	2026-01-23 06:13:05.149984	f
1958	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	6.721545e+06	1	6.721545e+06	t	2026-01-23 13:12:37.810857	f
1964	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	757375	1	757375	t	2026-01-23 14:33:41.760637	f
1965	4688	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.039473e+06	1	1.039473e+06	f	2026-01-23 16:38:48.841099	f
1966	4688	0477609b-080d-4cd2-b891-117e615bdf47	873158	2	1.0914475e+06	t	2026-01-23 16:38:49.288805	f
1968	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.113439e+06	1	1.113439e+06	t	2026-01-23 17:44:37.068099	f
1973	4691	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	7.781031e+06	1	7.781031e+06	t	2026-01-23 19:49:27.739753	f
1980	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	2.501628e+06	1	2.501628e+06	f	2026-01-23 20:00:42.556886	f
1995	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	1.040544e+06	5	1.6128432e+06	f	2026-01-23 21:56:42.724992	f
1996	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.184256e+06	4	1.6934861e+06	t	2026-01-23 21:56:43.143683	f
2003	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	935289	2	1.1691112e+06	t	2026-01-23 22:39:01.112932	f
2004	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.227567e+06	1	1.227567e+06	t	2026-01-23 22:39:01.531506	f
2005	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.031157e+06	2	1.2889462e+06	t	2026-01-23 22:39:01.930738	f
2006	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.353394e+06	1	1.353394e+06	t	2026-01-23 22:39:02.310175	f
2007	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.136851e+06	2	1.4210638e+06	t	2026-01-23 22:39:02.673471	f
2008	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.492117e+06	1	1.492117e+06	t	2026-01-23 22:39:03.037655	f
2009	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.253379e+06	2	1.5667238e+06	t	2026-01-23 22:39:03.406004	f
2010	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.64506e+06	1	1.64506e+06	t	2026-01-23 22:39:03.77044	f
2011	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.381851e+06	2	1.7273138e+06	t	2026-01-23 22:39:04.138191	f
2012	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.81368e+06	1	1.81368e+06	t	2026-01-23 22:39:04.507279	f
2013	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.523492e+06	2	1.904365e+06	t	2026-01-23 22:39:04.875305	f
2014	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.999584e+06	1	1.999584e+06	t	2026-01-23 22:39:05.257106	f
2015	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.679651e+06	2	2.0995638e+06	t	2026-01-23 22:39:05.624224	f
2016	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.204542e+06	1	2.204542e+06	t	2026-01-23 22:39:05.995106	f
2017	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.851816e+06	2	2.31477e+06	t	2026-01-23 22:39:06.361038	f
999	4604	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.956859e+06	3	3.9326225e+06	t	2026-01-18 14:39:24.38061	f
1020	4513	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.2e+06	4	6.006e+06	t	2026-01-18 16:03:47.015098	f
1021	4563	5d77ac22-c768-4d3b-99d8-73c250a3e859	969938	1	969938	f	2026-01-18 16:14:33.903123	f
1022	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	814748	2	1.018435e+06	t	2026-01-18 16:14:34.3311	f
1023	4568	5d77ac22-c768-4d3b-99d8-73c250a3e859	441000	1	441000	f	2026-01-18 16:25:08.752867	f
1024	4568	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	463050	1	463050	t	2026-01-18 16:25:09.533893	f
1025	4593	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.58954e+06	1	5.58954e+06	f	2026-01-18 16:29:25.163659	f
1026	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.318518e+06	1	5.318518e+06	f	2026-01-18 16:36:07.160594	f
1027	4598	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-18 16:37:46.737185	f
1028	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	3.594073e+06	5	5.570813e+06	t	2026-01-18 17:16:47.077892	f
1029	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.773777e+06	5	5.8493545e+06	t	2026-01-18 17:16:47.497616	f
1030	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	3.962466e+06	5	6.1418225e+06	t	2026-01-18 17:16:47.893211	f
1031	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.16059e+06	5	6.4489145e+06	t	2026-01-18 17:16:48.254415	f
1032	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	4.36862e+06	5	6.771361e+06	t	2026-01-18 17:16:48.620597	f
1033	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.587051e+06	5	7.109929e+06	t	2026-01-18 17:16:48.979273	f
1034	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	4.816404e+06	5	7.465426e+06	t	2026-01-18 17:16:49.345375	f
1035	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.057225e+06	5	7.838699e+06	t	2026-01-18 17:16:49.708941	f
1036	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	5.310087e+06	5	8.230635e+06	t	2026-01-18 17:16:50.100204	f
1037	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.575592e+06	5	8.642168e+06	t	2026-01-18 17:16:50.523494	f
1038	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	5.854372e+06	5	9.074277e+06	t	2026-01-18 17:16:50.899877	f
1039	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	6.147091e+06	5	9.527991e+06	t	2026-01-18 17:16:51.273974	f
1040	4590	6f591686-4009-4693-a2c7-d3eb1b36073f	6.454446e+06	5	1.0004391e+07	t	2026-01-18 17:28:51.260047	f
1041	4590	c4815f14-1981-43aa-b972-5f7a43ed0f13	6.777169e+06	5	1.0504612e+07	t	2026-01-18 17:28:51.675301	f
1042	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	698240	1	698240	f	2026-01-18 17:33:17.940078	f
1043	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	5.58954e+06	2	6.986925e+06	f	2026-01-18 17:34:08.316283	f
1044	4577	02538c92-2a46-43e6-8351-33297d6de099	8.623632e+06	3	1.1469431e+07	t	2026-01-18 18:13:43.130116	f
1045	4577	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	8.421611e+06	4	1.2042904e+07	t	2026-01-18 18:13:43.881097	f
1046	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.615712e+06	1	5.615712e+06	t	2026-01-18 18:20:00.155275	f
1047	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.433457e+06	3	5.896498e+06	t	2026-01-18 18:20:00.603008	f
1048	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.953059e+06	2	6.191324e+06	t	2026-01-18 18:20:28.856527	f
1049	4536	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.916636e+06	2	6.145795e+06	t	2026-01-18 18:23:55.048573	f
1050	4549	889cd08b-6e70-4f4c-847f-363dbbe2c110	8.065064e+06	2	1.008133e+07	t	2026-01-18 18:25:18.306339	f
1051	4536	6f591686-4009-4693-a2c7-d3eb1b36073f	6.453085e+06	1	6.453085e+06	f	2026-01-18 18:52:05.227315	f
1052	4847	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	400000	1	400000	f	2026-01-18 18:54:22.41343	f
1053	4540	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	400000	1	400000	f	2026-01-18 18:54:57.44826	f
1054	4847	d8be0952-18cc-4082-8a6c-5de14ea569ce	538625	1	538625	f	2026-01-18 19:10:12.044107	f
1055	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.887888e+06	3	6.500891e+06	t	2026-01-18 20:08:59.335391	f
1056	4507	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.460749e+06	2	6.825936e+06	t	2026-01-18 20:08:59.767054	f
1057	4507	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	5.388897e+06	3	7.167233e+06	t	2026-01-18 20:18:46.405665	f
1058	4536	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.420592e+06	2	6.77574e+06	t	2026-01-18 20:32:23.280944	f
1059	4513	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	5e+06	4	7.15e+06	f	2026-01-18 21:49:24.066465	f
1060	4604	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	4.368634e+06	3	5.810283e+06	t	2026-01-18 22:05:37.575917	f
1061	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	4.587066e+06	3	6.100798e+06	t	2026-01-18 22:05:37.97411	f
1062	4604	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	4.81642e+06	3	6.4058385e+06	t	2026-01-18 22:05:38.343155	f
1063	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.057241e+06	3	6.7261305e+06	t	2026-01-18 22:05:38.687483	f
1064	4604	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	5.310104e+06	3	7.0624385e+06	t	2026-01-18 22:05:39.030387	f
1065	4604	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.57561e+06	3	7.4155615e+06	t	2026-01-18 22:05:39.377373	f
1066	4604	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	5.854391e+06	3	7.78634e+06	t	2026-01-18 22:05:39.732602	f
1067	4570	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	6e+06	3	7.98e+06	f	2026-01-18 22:06:36.406219	f
1068	4570	388f55c3-52e1-499f-8a56-948636a8c205	5.859441e+06	4	8.3790005e+06	t	2026-01-18 22:06:36.810307	f
1069	4509	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.491607e+06	2	5.614509e+06	f	2026-01-18 22:37:08.277251	f
1070	4509	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.432508e+06	3	5.8952355e+06	t	2026-01-18 22:37:08.696836	f
1071	4509	5d77ac22-c768-4d3b-99d8-73c250a3e859	4.951998e+06	2	6.1899975e+06	f	2026-01-18 22:37:39.084516	f
1072	4563	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.120279e+06	1	1.120279e+06	f	2026-01-18 22:42:04.649277	f
1073	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	941035	2	1.1762938e+06	t	2026-01-18 22:42:05.075666	f
1074	4520	51f792dc-04f3-467f-a604-631165c75b38	9.65884e+06	1	9.65884e+06	t	2026-01-18 23:11:34.231516	f
1075	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	420000	1	420000	f	2026-01-19 00:34:52.746247	f
1076	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	441000	1	441000	t	2026-01-19 00:34:53.463809	f
1077	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	463050	1	463050	f	2026-01-19 00:35:06.737334	f
1078	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	486203	1	486203	t	2026-01-19 00:35:07.463387	f
1079	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	510514	1	510514	f	2026-01-19 00:35:16.690616	f
1080	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	536040	1	536040	t	2026-01-19 00:35:17.317785	f
1081	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	562842	1	562842	f	2026-01-19 00:51:35.530091	f
1082	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	590985	1	590985	t	2026-01-19 00:51:35.954338	f
1083	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	620535	1	620535	f	2026-01-19 00:51:41.939661	f
1084	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	651562	1	651562	t	2026-01-19 00:51:42.343354	f
1085	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	684141	1	684141	f	2026-01-19 00:51:46.702652	f
1086	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	718349	1	718349	t	2026-01-19 00:51:47.111542	f
1087	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	754267	1	754267	f	2026-01-19 00:51:52.747115	f
1088	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	791981	1	791981	t	2026-01-19 00:51:53.15419	f
1089	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	831581	1	831581	f	2026-01-19 00:52:51.432067	f
1090	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	873161	1	873161	t	2026-01-19 00:52:51.83605	f
1091	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	916820	1	916820	f	2026-01-19 00:52:57.879419	f
1092	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	962661	1	962661	t	2026-01-19 00:52:58.28163	f
1093	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.010795e+06	1	1.010795e+06	f	2026-01-19 00:53:02.681262	f
1094	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.061335e+06	1	1.061335e+06	t	2026-01-19 00:53:03.087045	f
1312	4593	02538c92-2a46-43e6-8351-33297d6de099	7.49052e+06	3	9.962392e+06	f	2026-01-20 04:16:01.267688	f
1313	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	7.865047e+06	3	1.0460513e+07	t	2026-01-20 04:16:01.679647	f
1346	4611	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.069399e+06	2	1.3367488e+06	t	2026-01-20 18:43:39.88356	f
1401	4596	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.168678e+06	1	3.168678e+06	f	2026-01-20 23:31:51.762162	f
1402	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	3.327112e+06	1	3.327112e+06	t	2026-01-20 23:31:52.169573	f
1445	4596	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	5.161449e+06	1	5.161449e+06	f	2026-01-21 01:22:47.920658	f
1487	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	8.15879e+06	2	1.0198488e+07	t	2026-01-21 06:32:42.833763	f
1488	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	8.051438e+06	3	1.0708413e+07	t	2026-01-21 06:32:43.251657	f
1489	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	8.995067e+06	2	1.1243834e+07	t	2026-01-21 06:32:43.617826	f
1490	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	8.876712e+06	3	1.1806027e+07	t	2026-01-21 06:32:43.980693	f
1509	4647	51f792dc-04f3-467f-a604-631165c75b38	791979	2	989973.75	t	2026-01-21 14:08:21.746705	f
1566	4614	51f792dc-04f3-467f-a604-631165c75b38	1.675451e+06	2	2.0943138e+06	t	2026-01-21 16:25:40.195207	f
1612	4611	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.753072e+06	1	4.753072e+06	t	2026-01-22 01:34:19.602978	f
1679	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	1	400000	t	2026-01-22 15:36:59.199273	f
1694	4661	889cd08b-6e70-4f4c-847f-363dbbe2c110	590985	1	590985	t	2026-01-22 16:07:59.020319	f
1701	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	831581	1	831581	t	2026-01-22 16:09:59.237687	f
1735	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.392996e+06	1	1.392996e+06	t	2026-01-22 18:42:22.263695	f
1736	4647	51f792dc-04f3-467f-a604-631165c75b38	1.170117e+06	2	1.4626462e+06	t	2026-01-22 18:42:22.702866	f
1737	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.535779e+06	1	1.535779e+06	t	2026-01-22 18:42:23.074861	f
1738	4647	51f792dc-04f3-467f-a604-631165c75b38	1.290055e+06	2	1.6125688e+06	t	2026-01-22 18:42:23.453225	f
1739	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.693198e+06	1	1.693198e+06	t	2026-01-22 18:42:23.824624	f
1740	4647	51f792dc-04f3-467f-a604-631165c75b38	1.422287e+06	2	1.7778588e+06	t	2026-01-22 18:42:24.19972	f
1741	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.866752e+06	1	1.866752e+06	t	2026-01-22 18:42:24.588163	f
1742	4647	51f792dc-04f3-467f-a604-631165c75b38	1.568072e+06	2	1.96009e+06	t	2026-01-22 18:42:24.953748	f
1743	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.058095e+06	1	2.058095e+06	t	2026-01-22 18:42:25.319393	f
1744	4647	51f792dc-04f3-467f-a604-631165c75b38	1.7288e+06	2	2.161e+06	t	2026-01-22 18:42:25.70128	f
1745	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.26905e+06	1	2.26905e+06	t	2026-01-22 18:42:26.291346	f
1746	4647	51f792dc-04f3-467f-a604-631165c75b38	1.906002e+06	2	2.3825025e+06	t	2026-01-22 18:42:26.660153	f
1772	4691	6f591686-4009-4693-a2c7-d3eb1b36073f	3.929943e+06	1	3.929943e+06	t	2026-01-22 19:47:20.155595	f
1773	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.126441e+06	1	4.126441e+06	t	2026-01-22 19:47:21.548381	f
1774	4691	6f591686-4009-4693-a2c7-d3eb1b36073f	4.332764e+06	1	4.332764e+06	t	2026-01-22 19:47:22.87178	f
1775	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	4.549403e+06	1	4.549403e+06	t	2026-01-22 19:47:24.297568	f
1776	4691	6f591686-4009-4693-a2c7-d3eb1b36073f	4.776874e+06	1	4.776874e+06	t	2026-01-22 19:47:25.839977	f
1777	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.015718e+06	1	5.015718e+06	t	2026-01-22 19:47:27.288446	f
1835	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.606789e+06	1	3.606789e+06	t	2026-01-22 23:11:55.403739	f
1847	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.0842468e+07	1	3.0842468e+07	t	2026-01-22 23:21:43.419283	f
1850	4671	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.976486e+06	1	3.976486e+06	t	2026-01-23 00:37:21.906715	f
1851	4671	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.175311e+06	1	4.175311e+06	t	2026-01-23 00:37:22.429807	f
1868	4664	0477609b-080d-4cd2-b891-117e615bdf47	1.906002e+06	2	2.3825025e+06	f	2026-01-23 01:45:25.451887	f
1878	4690	c532b6f7-bdfb-4505-b43f-f653770c03af	578813	1	578813	f	2026-01-23 02:13:17.52609	f
1879	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	486203	2	607753.75	t	2026-01-23 02:13:17.949312	f
1905	4659	02538c92-2a46-43e6-8351-33297d6de099	1.8282752e+07	3	2.431606e+07	f	2026-01-23 02:19:13.787068	f
1916	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.266504e+06	1	5.266504e+06	t	2026-01-23 02:31:41.914106	f
1917	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	5.52983e+06	1	5.52983e+06	t	2026-01-23 02:31:42.3596	f
1918	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.806322e+06	1	5.806322e+06	t	2026-01-23 02:31:42.729308	f
1919	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	6.096639e+06	1	6.096639e+06	t	2026-01-23 02:31:43.107557	f
1920	4691	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.401471e+06	1	6.401471e+06	t	2026-01-23 02:31:43.474019	f
1928	4688	0477609b-080d-4cd2-b891-117e615bdf47	486203	2	607753.75	f	2026-01-23 04:01:53.225555	f
1929	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	638142	1	638142	t	2026-01-23 04:01:53.639836	f
1930	4688	0477609b-080d-4cd2-b891-117e615bdf47	536040	2	670050	f	2026-01-23 04:01:58.971486	f
1931	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	703553	1	703553	t	2026-01-23 04:01:59.382994	f
1932	4688	0477609b-080d-4cd2-b891-117e615bdf47	590985	2	738731.25	f	2026-01-23 04:02:07.043728	f
1933	4688	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	775668	1	775668	t	2026-01-23 04:02:07.453417	f
1941	4694	4f229366-dbe3-4361-84cb-115cab42685f	441000	5	683550	t	2026-01-23 04:14:59.82229	f
1942	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	574182	2	717727.5	t	2026-01-23 04:15:00.245814	f
1943	4694	4f229366-dbe3-4361-84cb-115cab42685f	486203	5	753614.6	t	2026-01-23 04:15:00.609203	f
1944	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	633037	2	791296.25	t	2026-01-23 04:15:00.981129	f
1945	4694	4f229366-dbe3-4361-84cb-115cab42685f	536040	5	830862	t	2026-01-23 04:15:01.367216	f
1946	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	697925	2	872406.25	t	2026-01-23 04:15:01.739875	f
1947	4694	4f229366-dbe3-4361-84cb-115cab42685f	590985	5	916026.75	t	2026-01-23 04:15:02.111141	f
1948	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	769463	2	961828.75	t	2026-01-23 04:15:02.488193	f
1949	4694	4f229366-dbe3-4361-84cb-115cab42685f	651562	5	1.0099211e+06	t	2026-01-23 04:15:02.867031	f
1950	4694	f335b9c3-7d63-44f3-9540-13b1d461ca13	848334	2	1.0604175e+06	t	2026-01-23 04:15:03.241488	f
1957	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.278637e+06	1	4.278637e+06	t	2026-01-23 06:13:07.321155	f
1959	4701	cc78d40c-9179-4616-9834-9aa9c69963fa	400000	1	400000	t	2026-01-23 13:32:51.453307	f
1967	4696	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	1	400000	t	2026-01-23 16:41:25.522074	f
1969	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.492569e+06	1	4.492569e+06	t	2026-01-23 17:46:08.160341	f
1974	4691	e2831203-b5bb-4911-9a98-485fe4c6e3b5	8.170083e+06	1	8.170083e+06	t	2026-01-23 19:49:28.212194	f
1981	4690	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.101368e+06	2	2.62671e+06	t	2026-01-23 21:14:28.617913	f
1997	4685	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.717198e+06	1	4.717198e+06	t	2026-01-23 22:14:39.907211	f
1998	4685	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.953058e+06	1	4.953058e+06	t	2026-01-23 22:14:40.330368	f
2018	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.430509e+06	1	2.430509e+06	t	2026-01-23 22:39:06.729444	f
2019	4694	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.041628e+06	2	2.552035e+06	t	2026-01-23 22:39:07.092285	f
2020	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.679637e+06	1	2.679637e+06	t	2026-01-23 22:39:07.463277	f
1095	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.114402e+06	1	1.114402e+06	f	2026-01-19 00:53:08.93299	f
1096	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.170123e+06	1	1.170123e+06	t	2026-01-19 00:53:09.331145	f
1097	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.22863e+06	1	1.22863e+06	f	2026-01-19 00:53:14.544261	f
1098	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.290062e+06	1	1.290062e+06	t	2026-01-19 00:53:14.948074	f
1099	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.354566e+06	1	1.354566e+06	f	2026-01-19 00:53:31.628989	f
1100	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.422295e+06	1	1.422295e+06	t	2026-01-19 00:53:32.033928	f
1101	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.49341e+06	1	1.49341e+06	f	2026-01-19 00:53:36.188403	f
1102	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.568081e+06	1	1.568081e+06	t	2026-01-19 00:53:36.595628	f
1103	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.646486e+06	1	1.646486e+06	f	2026-01-19 00:53:41.787641	f
1104	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.728811e+06	1	1.728811e+06	t	2026-01-19 00:53:42.173493	f
1105	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	1.815252e+06	1	1.815252e+06	f	2026-01-19 00:53:46.725018	f
1106	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.906015e+06	1	1.906015e+06	t	2026-01-19 00:53:47.124473	f
1107	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	2.001316e+06	1	2.001316e+06	f	2026-01-19 00:53:51.39529	f
1108	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.101382e+06	1	2.101382e+06	t	2026-01-19 00:53:51.802602	f
1109	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	2.206452e+06	1	2.206452e+06	f	2026-01-19 01:00:01.266342	f
1110	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.316775e+06	1	2.316775e+06	t	2026-01-19 01:00:01.676299	f
1111	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	2.432614e+06	1	2.432614e+06	f	2026-01-19 01:00:08.985895	f
1112	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.554245e+06	1	2.554245e+06	t	2026-01-19 01:00:09.395869	f
1113	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	2.681958e+06	1	2.681958e+06	f	2026-01-19 01:00:14.411895	f
1114	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.816056e+06	1	2.816056e+06	t	2026-01-19 01:00:14.822372	f
1115	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	2.956859e+06	1	2.956859e+06	f	2026-01-19 01:00:19.057357	f
1116	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.104702e+06	1	3.104702e+06	t	2026-01-19 01:00:19.445871	f
1117	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	3.259938e+06	1	3.259938e+06	f	2026-01-19 01:01:35.878286	f
1118	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.422935e+06	1	3.422935e+06	t	2026-01-19 01:01:36.292746	f
1119	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	3.594082e+06	1	3.594082e+06	f	2026-01-19 01:01:42.611587	f
1120	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.773787e+06	1	3.773787e+06	t	2026-01-19 01:01:43.020438	f
1121	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	3.962477e+06	1	3.962477e+06	f	2026-01-19 01:01:48.016383	f
1122	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.160601e+06	1	4.160601e+06	t	2026-01-19 01:01:48.419926	f
1123	4505	d8be0952-18cc-4082-8a6c-5de14ea569ce	749824	1	749824	f	2026-01-19 01:07:54.930275	f
1124	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	4.368632e+06	1	4.368632e+06	f	2026-01-19 01:15:34.948263	f
1125	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.587064e+06	1	4.587064e+06	t	2026-01-19 01:15:35.359846	f
1126	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	4.816418e+06	1	4.816418e+06	f	2026-01-19 01:15:40.086008	f
1127	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	5.057239e+06	1	5.057239e+06	t	2026-01-19 01:15:40.487737	f
1128	4536	6f591686-4009-4693-a2c7-d3eb1b36073f	7.114527e+06	1	7.114527e+06	f	2026-01-19 01:33:40.732133	f
1129	4536	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.976203e+06	2	7.470254e+06	t	2026-01-19 01:33:41.138674	f
1130	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.0141782e+07	1	1.0141782e+07	f	2026-01-19 01:39:11.377113	f
1131	4520	51f792dc-04f3-467f-a604-631165c75b38	1.0648872e+07	1	1.0648872e+07	t	2026-01-19 01:39:11.795625	f
1132	4520	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.1181316e+07	1	1.1181316e+07	f	2026-01-19 02:02:21.212566	f
1133	4536	51f792dc-04f3-467f-a604-631165c75b38	7.843767e+06	1	7.843767e+06	t	2026-01-19 02:27:49.765677	f
1134	4539	51f792dc-04f3-467f-a604-631165c75b38	540750	1	540750	t	2026-01-19 02:32:42.60824	f
1135	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	454230	2	567787.5	t	2026-01-19 02:32:43.043684	f
1136	4539	51f792dc-04f3-467f-a604-631165c75b38	596177	1	596177	t	2026-01-19 02:32:43.422975	f
1137	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	500789	2	625986.25	t	2026-01-19 02:32:43.80291	f
1138	4539	51f792dc-04f3-467f-a604-631165c75b38	657286	1	657286	t	2026-01-19 02:32:44.180573	f
1139	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	552121	2	690151.25	t	2026-01-19 02:32:44.561391	f
1140	4539	51f792dc-04f3-467f-a604-631165c75b38	724659	1	724659	t	2026-01-19 02:32:44.946154	f
1141	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	608714	2	760892.5	t	2026-01-19 02:32:45.328053	f
1142	4539	51f792dc-04f3-467f-a604-631165c75b38	798938	1	798938	t	2026-01-19 02:32:45.727759	f
1143	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	671108	2	838885	t	2026-01-19 02:32:46.125531	f
1144	4539	51f792dc-04f3-467f-a604-631165c75b38	880830	1	880830	t	2026-01-19 02:32:46.511442	f
1145	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	739898	2	924872.5	t	2026-01-19 02:32:46.894032	f
1146	4539	51f792dc-04f3-467f-a604-631165c75b38	971117	1	971117	t	2026-01-19 02:32:47.282352	f
1147	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	815739	2	1.01967375e+06	t	2026-01-19 02:32:47.668568	f
1148	4539	51f792dc-04f3-467f-a604-631165c75b38	1.070658e+06	1	1.070658e+06	t	2026-01-19 02:32:48.048221	f
1149	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	899353	2	1.1241912e+06	t	2026-01-19 02:32:48.433828	f
1150	4539	51f792dc-04f3-467f-a604-631165c75b38	1.180401e+06	1	1.180401e+06	t	2026-01-19 02:33:16.476372	f
1151	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	991537	2	1.2394212e+06	t	2026-01-19 02:33:16.957215	f
1152	4539	51f792dc-04f3-467f-a604-631165c75b38	1.301393e+06	1	1.301393e+06	t	2026-01-19 02:33:17.357181	f
1153	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.093171e+06	2	1.3664638e+06	t	2026-01-19 02:33:17.755103	f
1154	4539	51f792dc-04f3-467f-a604-631165c75b38	1.434787e+06	1	1.434787e+06	t	2026-01-19 02:33:18.130455	f
1155	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.506527e+06	1	1.506527e+06	t	2026-01-19 03:01:26.631578	f
1156	4539	51f792dc-04f3-467f-a604-631165c75b38	1.581854e+06	1	1.581854e+06	t	2026-01-19 03:01:27.040218	f
1157	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.660947e+06	1	1.660947e+06	t	2026-01-19 03:01:27.406903	f
1158	4539	51f792dc-04f3-467f-a604-631165c75b38	1.743995e+06	1	1.743995e+06	t	2026-01-19 03:01:27.763212	f
1159	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.831195e+06	1	1.831195e+06	t	2026-01-19 03:01:28.125351	f
1160	4539	51f792dc-04f3-467f-a604-631165c75b38	1.922755e+06	1	1.922755e+06	t	2026-01-19 03:01:28.483583	f
1161	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.018893e+06	1	2.018893e+06	t	2026-01-19 03:01:28.836042	f
1162	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	6.615001e+06	3	8.797951e+06	t	2026-01-19 03:14:20.038781	f
1163	4570	388f55c3-52e1-499f-8a56-948636a8c205	6.460034e+06	4	9.237849e+06	t	2026-01-19 03:14:20.496177	f
1164	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	7.293039e+06	3	9.699742e+06	t	2026-01-19 03:14:20.884037	f
1165	4570	388f55c3-52e1-499f-8a56-948636a8c205	7.122189e+06	4	1.018473e+07	t	2026-01-19 03:14:21.271947	f
1166	4579	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	1	400000	t	2026-01-19 03:41:53.960679	f
1167	4568	d8be0952-18cc-4082-8a6c-5de14ea569ce	898754	1	898754	f	2026-01-19 03:46:27.909587	f
1168	4568	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	943692	1	943692	t	2026-01-19 03:46:28.315741	f
1169	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	987876	1	987876	f	2026-01-19 03:48:02.757698	f
1170	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	733152	1	733152	t	2026-01-19 03:53:02.130553	f
1171	4570	6f591686-4009-4693-a2c7-d3eb1b36073f	7.478299e+06	4	1.0693968e+07	f	2026-01-19 04:07:04.734059	f
1172	4570	388f55c3-52e1-499f-8a56-948636a8c205	7.852215e+06	4	1.1228667e+07	t	2026-01-19 04:07:05.150658	f
1173	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	769810	1	769810	f	2026-01-19 04:08:48.122583	f
1174	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	808301	1	808301	t	2026-01-19 04:08:48.533961	f
1175	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	848717	1	848717	f	2026-01-19 04:08:56.251827	f
1176	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	891153	1	891153	t	2026-01-19 04:08:56.665562	f
1177	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	935711	1	935711	f	2026-01-19 04:09:01.838989	f
1178	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	982497	1	982497	t	2026-01-19 04:09:02.246976	f
1179	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.031622e+06	1	1.031622e+06	f	2026-01-19 04:09:06.019963	f
1180	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.083204e+06	1	1.083204e+06	t	2026-01-19 04:09:06.445643	f
1181	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.137365e+06	1	1.137365e+06	f	2026-01-19 04:09:10.512955	f
1182	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.194234e+06	1	1.194234e+06	t	2026-01-19 04:09:10.924947	f
1183	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.253946e+06	1	1.253946e+06	f	2026-01-19 04:09:14.53767	f
1184	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.316644e+06	1	1.316644e+06	t	2026-01-19 04:09:14.94655	f
1185	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.382477e+06	1	1.382477e+06	f	2026-01-19 04:09:20.90335	f
1186	4596	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.451601e+06	1	1.451601e+06	t	2026-01-19 04:09:21.306583	f
1187	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	1.524182e+06	1	1.524182e+06	f	2026-01-19 04:09:26.368812	f
1188	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	565557	1	565557	t	2026-01-19 04:31:50.145239	f
1189	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.695871e+06	2	2.1198388e+06	t	2026-01-19 04:35:35.059278	f
1190	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.225831e+06	1	2.225831e+06	t	2026-01-19 04:35:35.483693	f
1191	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.869699e+06	2	2.3371238e+06	t	2026-01-19 04:35:35.843628	f
1192	4539	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.45398e+06	1	2.45398e+06	t	2026-01-19 04:35:36.219095	f
1193	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.061344e+06	2	2.57668e+06	t	2026-01-19 04:35:36.572951	f
1194	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	928653	3	1.2351085e+06	t	2026-01-19 13:12:28.862815	f
1195	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.037492e+06	2	1.296865e+06	t	2026-01-19 13:12:29.280417	f
1196	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.023841e+06	3	1.3617085e+06	t	2026-01-19 13:12:29.637028	f
1197	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.143836e+06	2	1.429795e+06	t	2026-01-19 13:12:30.000941	f
1198	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.128786e+06	3	1.5012854e+06	t	2026-01-19 13:12:30.353716	f
1199	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.26108e+06	2	1.57635e+06	t	2026-01-19 13:12:30.709135	f
1200	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.244487e+06	3	1.6551678e+06	t	2026-01-19 13:12:31.068039	f
1201	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.390341e+06	2	1.7379262e+06	t	2026-01-19 13:12:31.429131	f
1202	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.372047e+06	3	1.8248225e+06	t	2026-01-19 13:12:31.781733	f
1203	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	888523	2	1.1106538e+06	t	2026-01-19 14:01:24.606833	f
1204	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	5.449527e+06	3	7.247871e+06	t	2026-01-19 14:10:37.224958	f
1205	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.722004e+06	3	7.6102655e+06	t	2026-01-19 14:10:37.87394	f
1206	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	6.008105e+06	3	7.9907795e+06	t	2026-01-19 14:10:38.505439	f
1207	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.308511e+06	3	8.39032e+06	t	2026-01-19 14:10:40.206046	f
1208	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	6.623937e+06	3	8.809836e+06	t	2026-01-19 14:10:51.906474	f
1209	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.955134e+06	3	9.250328e+06	t	2026-01-19 14:11:00.805022	f
1210	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	7.302891e+06	3	9.712845e+06	t	2026-01-19 14:11:06.516707	f
1211	4544	889cd08b-6e70-4f4c-847f-363dbbe2c110	400000	1	400000	t	2026-01-19 16:07:40.711104	f
1212	4603	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.318518e+06	2	6.6481475e+06	f	2026-01-19 16:47:52.095471	f
1213	4847	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	593835	1	593835	f	2026-01-19 17:40:32.432118	f
1214	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	623527	1	623527	t	2026-01-19 17:40:34.206186	f
1215	4568	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	990877	1	990877	f	2026-01-19 17:41:10.255426	f
1216	4568	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1.040421e+06	1	1.040421e+06	t	2026-01-19 17:41:11.975195	f
1217	4592	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	606000	1	606000	f	2026-01-19 17:42:55.569344	f
1218	4847	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	654704	1	654704	f	2026-01-19 17:44:50.278714	f
1219	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	687440	1	687440	t	2026-01-19 17:44:51.220186	f
1220	4847	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	721812	1	721812	f	2026-01-19 17:45:00.760782	f
1221	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	757903	1	757903	t	2026-01-19 17:45:01.458501	f
1222	4563	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.532851e+06	2	1.9160638e+06	f	2026-01-19 17:47:02.855631	f
1223	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.512682e+06	3	2.011867e+06	t	2026-01-19 17:47:03.271497	f
1224	4593	02538c92-2a46-43e6-8351-33297d6de099	5.58954e+06	3	7.434088e+06	f	2026-01-19 18:28:54.118379	f
1225	4593	6f591686-4009-4693-a2c7-d3eb1b36073f	5.869017e+06	3	7.8057925e+06	f	2026-01-19 19:53:42.640646	f
1226	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	795799	1	795799	t	2026-01-19 19:53:45.12168	f
1227	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	835589	1	835589	t	2026-01-19 19:53:45.538923	f
1228	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	877369	1	877369	t	2026-01-19 19:53:45.917082	f
1229	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	921238	1	921238	t	2026-01-19 19:53:46.258802	f
1230	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	967300	1	967300	t	2026-01-19 19:53:46.621116	f
1231	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.015665e+06	1	1.015665e+06	t	2026-01-19 19:53:46.965907	f
1232	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.066449e+06	1	1.066449e+06	t	2026-01-19 19:53:47.40275	f
1233	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.119772e+06	1	1.119772e+06	t	2026-01-19 19:53:47.763764	f
1234	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.175761e+06	1	1.175761e+06	t	2026-01-19 19:53:48.115305	f
1235	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.23455e+06	1	1.23455e+06	t	2026-01-19 19:53:48.46792	f
1236	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.296278e+06	1	1.296278e+06	t	2026-01-19 19:53:48.829984	f
1237	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.361092e+06	1	1.361092e+06	t	2026-01-19 19:53:49.226063	f
1238	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.429147e+06	1	1.429147e+06	t	2026-01-19 19:53:49.57034	f
1239	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.500605e+06	1	1.500605e+06	t	2026-01-19 19:53:49.91992	f
1240	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.575636e+06	1	1.575636e+06	t	2026-01-19 19:53:50.277512	f
1241	4847	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.654418e+06	1	1.654418e+06	f	2026-01-19 20:13:36.152485	f
1242	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.737139e+06	1	1.737139e+06	t	2026-01-19 20:13:36.575762	f
1243	4563	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.112461e+06	1	2.112461e+06	f	2026-01-19 20:33:56.020148	f
1244	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.667733e+06	3	2.218085e+06	t	2026-01-19 20:33:56.758736	f
1245	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.823996e+06	1	1.823996e+06	t	2026-01-19 20:45:47.914367	f
1246	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	1.915196e+06	1	1.915196e+06	t	2026-01-19 20:45:48.786582	f
1247	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.010956e+06	1	2.010956e+06	t	2026-01-19 20:46:32.400497	f
1248	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	2.111504e+06	1	2.111504e+06	t	2026-01-19 20:52:47.573081	f
1249	4847	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.21708e+06	1	2.21708e+06	t	2026-01-19 20:52:48.004891	f
1250	4847	6f591686-4009-4693-a2c7-d3eb1b36073f	2.327934e+06	1	2.327934e+06	t	2026-01-19 20:52:48.365243	f
1251	4593	02538c92-2a46-43e6-8351-33297d6de099	6.162468e+06	3	8.1960825e+06	f	2026-01-19 20:59:44.681369	f
1252	4611	02538c92-2a46-43e6-8351-33297d6de099	700000	1	700000	f	2026-01-19 21:00:01.500322	f
1253	4601	5d77ac22-c768-4d3b-99d8-73c250a3e859	400000	1	400000	f	2026-01-19 21:00:31.119233	f
1254	4624	5d77ac22-c768-4d3b-99d8-73c250a3e859	5.69622e+06	1	5.69622e+06	f	2026-01-19 21:02:30.06545	f
1255	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.75112e+06	3	2.3289895e+06	t	2026-01-19 21:09:06.80045	f
1256	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	1.838676e+06	3	2.445439e+06	t	2026-01-19 21:09:07.244125	f
1257	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.93061e+06	3	2.5677112e+06	t	2026-01-19 21:10:10.25521	f
1258	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	2.027141e+06	3	2.6960975e+06	t	2026-01-19 21:10:10.770221	f
1259	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.128499e+06	3	2.8309038e+06	t	2026-01-19 21:10:11.223966	f
1260	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	2.234925e+06	3	2.9724502e+06	t	2026-01-19 21:10:11.67442	f
1261	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.346672e+06	3	3.1210738e+06	t	2026-01-19 21:11:20.226497	f
1262	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	2.464006e+06	3	3.277128e+06	t	2026-01-19 21:11:20.608733	f
1263	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.587207e+06	3	3.4409852e+06	t	2026-01-19 21:11:20.952147	f
1264	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	2.716568e+06	3	3.6130355e+06	t	2026-01-19 21:11:21.296732	f
1265	4563	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.852397e+06	3	3.793688e+06	t	2026-01-19 21:11:21.643555	f
1266	4563	cc78d40c-9179-4616-9834-9aa9c69963fa	2.995017e+06	3	3.9833725e+06	t	2026-01-19 21:11:22.016749	f
1267	4568	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.092443e+06	1	1.092443e+06	f	2026-01-19 23:17:38.759948	f
1268	4539	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.164412e+06	2	2.705515e+06	t	2026-01-20 00:07:23.007649	f
1269	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.272633e+06	2	2.8407912e+06	t	2026-01-20 00:07:23.656556	f
1270	4539	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.386265e+06	2	2.9828312e+06	t	2026-01-20 00:07:24.234514	f
1271	4586	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.03727e+06	1	1.03727e+06	t	2026-01-20 00:25:14.176003	f
1272	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.505579e+06	2	3.1319738e+06	t	2026-01-20 01:02:38.849155	f
1273	4539	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.630858e+06	2	3.2885725e+06	t	2026-01-20 01:02:39.245544	f
1274	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.762401e+06	2	3.4530012e+06	t	2026-01-20 01:02:39.589798	f
1275	4568	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.895786e+06	2	2.3697325e+06	f	2026-01-20 01:35:05.910896	f
1276	4568	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.48822e+06	1	2.48822e+06	t	2026-01-20 01:35:06.317617	f
1277	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	871307	2	1.0891338e+06	t	2026-01-20 01:37:22.099867	f
1278	4586	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.143591e+06	1	1.143591e+06	t	2026-01-20 01:37:22.469273	f
1279	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	960617	2	1.2007712e+06	t	2026-01-20 01:37:22.81774	f
1280	4586	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.26081e+06	1	1.26081e+06	t	2026-01-20 01:37:23.165312	f
1281	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.059081e+06	2	1.3238512e+06	t	2026-01-20 01:37:23.515596	f
1282	4586	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.390044e+06	1	1.390044e+06	t	2026-01-20 01:37:23.860252	f
1283	4586	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.167637e+06	2	1.4595462e+06	t	2026-01-20 01:37:24.205379	f
1284	4541	c532b6f7-bdfb-4505-b43f-f653770c03af	5.310101e+06	1	5.310101e+06	f	2026-01-20 01:44:53.04944	f
1285	4541	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	5.575607e+06	1	5.575607e+06	t	2026-01-20 01:56:54.297047	f
1286	4592	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	636300	1	636300	t	2026-01-20 01:58:36.906349	f
1287	4539	5084741d-1673-42b3-a8e3-3d422874e814	2.900522e+06	2	3.6256525e+06	f	2026-01-20 01:58:48.683131	f
1288	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.045549e+06	2	3.8069362e+06	t	2026-01-20 01:58:49.326967	f
1289	4539	5084741d-1673-42b3-a8e3-3d422874e814	3.197827e+06	2	3.9972838e+06	f	2026-01-20 01:59:17.258192	f
1290	4539	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.357719e+06	2	4.197149e+06	t	2026-01-20 01:59:17.661165	f
1291	4539	5084741d-1673-42b3-a8e3-3d422874e814	3.525606e+06	2	4.4070075e+06	f	2026-01-20 01:59:36.677716	f
1361	4592	6f591686-4009-4693-a2c7-d3eb1b36073f	2.170266e+06	1	2.170266e+06	f	2026-01-20 21:12:36.317411	f
1403	4596	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	3.493468e+06	1	3.493468e+06	f	2026-01-20 23:32:00.451713	f
1404	4596	6f591686-4009-4693-a2c7-d3eb1b36073f	3.668142e+06	1	3.668142e+06	t	2026-01-20 23:32:00.857774	f
1446	4598	f335b9c3-7d63-44f3-9540-13b1d461ca13	684141	2	855176.25	t	2026-01-21 01:24:54.535028	f
1447	4598	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	897936	1	897936	t	2026-01-21 01:24:54.966088	f
1467	4603	51f792dc-04f3-467f-a604-631165c75b38	1.0313466e+07	1	1.0313466e+07	t	2026-01-21 02:22:48.486688	f
1491	4621	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.320548e+06	3	1.2396329e+07	t	2026-01-21 06:37:23.603073	f
1492	4621	c4815f14-1981-43aa-b972-5f7a43ed0f13	9.786576e+06	3	1.3016146e+07	t	2026-01-21 06:37:24.017288	f
1516	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	2	500000	t	2026-01-21 14:20:56.887951	f
1517	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	420000	2	525000	t	2026-01-21 14:21:03.688222	f
1518	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	441000	2	551250	t	2026-01-21 14:21:18.186098	f
1519	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	463050	2	578812.5	t	2026-01-21 14:21:26.087478	f
1520	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	486203	2	607753.75	t	2026-01-21 14:21:33.389472	f
1521	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	510514	2	638142.5	t	2026-01-21 14:21:40.688031	f
1522	4692	c4815f14-1981-43aa-b972-5f7a43ed0f13	536040	2	670050	t	2026-01-21 14:21:48.687197	f
1567	4614	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.759224e+06	2	2.19903e+06	t	2026-01-21 16:25:40.964917	f
1574	4614	51f792dc-04f3-467f-a604-631165c75b38	2.47541e+06	2	3.0942625e+06	t	2026-01-21 16:25:45.854939	f
1582	4614	51f792dc-04f3-467f-a604-631165c75b38	3.657313e+06	2	4.571641e+06	t	2026-01-21 16:25:50.966566	f
1613	4633	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.114402e+06	1	1.114402e+06	f	2026-01-22 01:45:09.248348	f
1614	4633	51f792dc-04f3-467f-a604-631165c75b38	1.170123e+06	1	1.170123e+06	t	2026-01-22 01:45:09.672851	f
1680	4660	02538c92-2a46-43e6-8351-33297d6de099	1.0765172e+07	2	1.3456465e+07	f	2026-01-22 15:49:45.13384	f
1681	4660	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.4129289e+07	1	1.4129289e+07	t	2026-01-22 15:49:45.555241	f
1697	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	684141	1	684141	t	2026-01-22 16:08:00.465916	f
1699	4661	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	754267	1	754267	t	2026-01-22 16:08:01.492825	f
1747	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.501628e+06	1	2.501628e+06	t	2026-01-22 18:43:09.268727	f
1748	4647	51f792dc-04f3-467f-a604-631165c75b38	2.101368e+06	2	2.62671e+06	t	2026-01-22 18:43:09.729356	f
1749	4647	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.758046e+06	1	2.758046e+06	t	2026-01-22 18:43:10.133832	f
1750	4647	51f792dc-04f3-467f-a604-631165c75b38	2.316759e+06	2	2.8959488e+06	t	2026-01-22 18:43:10.518274	f
2029	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	525000	1	525000	t	2026-01-24 00:46:16.434261	f
2030	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	441000	2	551250	t	2026-01-24 00:46:16.857041	f
2031	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	578813	1	578813	t	2026-01-24 00:46:17.23895	f
2032	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	486203	2	607753.75	t	2026-01-24 00:46:17.61256	f
2033	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	638142	1	638142	t	2026-01-24 00:46:17.978633	f
2034	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	536040	2	670050	t	2026-01-24 00:46:18.355341	f
2035	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	703553	1	703553	t	2026-01-24 00:46:18.739969	f
2036	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	590985	2	738731.25	t	2026-01-24 00:46:19.115409	f
2037	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	775668	1	775668	t	2026-01-24 00:46:19.483409	f
2038	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	651562	2	814452.5	t	2026-01-24 00:46:19.851908	f
2039	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	855176	1	855176	t	2026-01-24 00:46:20.222001	f
2040	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	718348	2	897935	t	2026-01-24 00:46:20.588804	f
2041	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	942832	1	942832	t	2026-01-24 00:46:20.955045	f
2042	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	791979	2	989973.75	t	2026-01-24 00:46:21.324304	f
2043	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	420000	1	420000	t	2026-01-24 00:46:34.159565	f
2044	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	400000	2	500000	t	2026-01-24 00:46:34.578276	f
2045	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	525000	1	525000	t	2026-01-24 00:46:34.960996	f
2046	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	441000	2	551250	t	2026-01-24 00:46:35.327198	f
2047	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	578813	1	578813	t	2026-01-24 00:46:35.688032	f
2048	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	486203	2	607753.75	t	2026-01-24 00:46:36.077946	f
2049	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	638142	1	638142	t	2026-01-24 00:46:36.442536	f
2050	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	536040	2	670050	t	2026-01-24 00:46:36.812909	f
2051	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	703553	1	703553	t	2026-01-24 00:46:37.183262	f
2052	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	590985	2	738731.25	t	2026-01-24 00:46:37.547539	f
2053	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	775668	1	775668	t	2026-01-24 00:46:37.910869	f
2054	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	651562	2	814452.5	t	2026-01-24 00:46:38.273726	f
2055	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	855176	1	855176	t	2026-01-24 00:46:38.639119	f
2056	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	718348	2	897935	t	2026-01-24 00:46:39.018944	f
2057	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	942832	1	942832	t	2026-01-24 00:46:39.383113	f
2058	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	791979	2	989973.75	t	2026-01-24 00:46:39.747906	f
2059	4692	4f229366-dbe3-4361-84cb-115cab42685f	525453	5	814452.1	t	2026-01-24 00:48:09.758992	f
2060	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	642989	3	855175.4	t	2026-01-24 00:48:10.182825	f
2061	4692	4f229366-dbe3-4361-84cb-115cab42685f	579313	5	897935.1	t	2026-01-24 00:48:10.588594	f
2062	4692	17faf686-27d1-4e30-a11c-4e7ec21ca685	708897	3	942833	t	2026-01-24 00:48:10.957	f
2063	4685	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.020475e+06	1	6.020475e+06	t	2026-01-24 01:24:50.921437	f
2064	4694	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.257118e+06	1	3.257118e+06	t	2026-01-24 01:25:12.417911	f
2065	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	525000	1	525000	t	2026-01-24 01:25:57.308269	f
2066	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-24 01:25:57.754173	f
2067	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	578813	1	578813	t	2026-01-24 01:25:58.127974	f
2068	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-24 01:25:58.51806	f
2069	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	638142	1	638142	t	2026-01-24 01:25:58.889622	f
2070	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-24 01:25:59.264755	f
2071	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	703553	1	703553	t	2026-01-24 01:25:59.634643	f
2072	4680	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	2	738731.25	t	2026-01-24 01:26:00.003017	f
2073	4680	889cd08b-6e70-4f4c-847f-363dbbe2c110	775668	1	775668	t	2026-01-24 01:26:31.202184	f
2074	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	748810	1	748810	t	2026-01-24 01:39:30.660663	f
2075	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	713152	2	891440	t	2026-01-24 01:39:31.082843	f
2076	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	936012	1	936012	t	2026-01-24 01:39:31.451026	f
2077	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	786251	2	982813.75	t	2026-01-24 01:39:31.826282	f
2078	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.031955e+06	1	1.031955e+06	t	2026-01-24 01:39:32.197667	f
2079	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	866843	2	1.0835538e+06	t	2026-01-24 01:39:32.564664	f
2080	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.137732e+06	1	1.137732e+06	t	2026-01-24 01:39:32.926029	f
2081	4705	f335b9c3-7d63-44f3-9540-13b1d461ca13	955695	2	1.1946188e+06	t	2026-01-24 01:39:33.296467	f
2082	4705	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.25435e+06	1	1.25435e+06	t	2026-01-24 01:39:33.66569	f
2083	4685	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	6.321499e+06	1	6.321499e+06	f	2026-01-24 01:49:01.184653	f
2084	4690	7779ed21-af49-4fbd-8127-c5a869384569	2.758046e+06	1	2.758046e+06	f	2026-01-24 02:08:37.789825	f
2085	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-24 03:42:38.493525	f
2086	4724	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.322322e+06	3	4.4186885e+06	t	2026-01-24 13:17:30.004933	f
2087	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.711699e+06	2	4.639624e+06	t	2026-01-24 13:17:32.040486	f
2088	4724	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.897284e+06	3	5.1833875e+06	t	2026-01-24 13:17:33.722844	f
2089	4724	e2831203-b5bb-4911-9a98-485fe4c6e3b5	3.662862e+06	3	4.8716065e+06	t	2026-01-24 13:17:33.868341	f
2090	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.354046e+06	2	5.4425575e+06	t	2026-01-24 13:17:35.649193	f
2091	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.354046e+06	2	5.4425575e+06	t	2026-01-24 13:17:35.67552	f
2092	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-24 14:02:41.389817	f
2093	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	8.362016e+06	3	1.1121481e+07	t	2026-01-24 14:03:26.689082	f
2094	4789	388f55c3-52e1-499f-8a56-948636a8c205	1.558514e+06	2	1.9481425e+06	t	2026-01-24 14:11:32.889289	f
2095	4790	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.430954e+06	2	6.7886925e+06	t	2026-01-24 14:11:53.090265	f
2096	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	500000	1	500000	t	2026-01-24 14:21:26.490584	f
2097	4802	c4815f14-1981-43aa-b972-5f7a43ed0f13	650000	1	650000	f	2026-01-24 14:40:49.329872	f
2098	4719	02538c92-2a46-43e6-8351-33297d6de099	7.610239e+06	5	1.179587e+07	f	2026-01-24 15:59:30.38527	f
2099	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	918750	1	918750	t	2026-01-24 18:01:10.719449	f
2100	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	771750	2	964687.5	t	2026-01-24 18:01:11.158679	f
2101	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.012922e+06	1	1.012922e+06	t	2026-01-24 18:01:11.545664	f
2102	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	850855	2	1.0635688e+06	t	2026-01-24 18:01:11.903529	f
2103	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.116748e+06	1	1.116748e+06	t	2026-01-24 18:01:12.289513	f
2104	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	938069	2	1.1725862e+06	t	2026-01-24 18:01:12.651639	f
2105	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.231216e+06	1	1.231216e+06	t	2026-01-24 18:01:13.017215	f
2106	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.034222e+06	2	1.2927775e+06	t	2026-01-24 18:01:13.385745	f
2107	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.357417e+06	1	1.357417e+06	t	2026-01-24 18:01:13.762791	f
2108	4710	e08f4fb4-f7df-4224-9a81-21c0f93cf810	400000	1	400000	f	2026-01-24 18:03:27.232961	f
2109	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	2.390036e+06	4	3.4177515e+06	t	2026-01-24 19:27:00.29091	f
2110	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.509538e+06	4	3.5886392e+06	t	2026-01-24 19:27:00.740953	f
2111	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	2.635015e+06	4	3.7680715e+06	t	2026-01-24 19:27:01.111195	f
2112	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.766766e+06	4	3.9564755e+06	t	2026-01-24 19:27:01.497345	f
2113	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	2.905105e+06	4	4.1543002e+06	t	2026-01-24 19:27:01.88502	f
2114	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.050361e+06	4	4.362016e+06	t	2026-01-24 19:27:02.308288	f
2801	4823	c532b6f7-bdfb-4505-b43f-f653770c03af	578813	1	578813	f	2026-01-28 02:06:45.373222	f
2116	4712	4f229366-dbe3-4361-84cb-115cab42685f	400000	1	400000	f	2026-01-24 20:19:15.431106	f
2117	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	659298	2	824122.5	t	2026-01-24 22:49:32.430077	f
2118	4789	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.63644e+06	2	2.04555e+06	t	2026-01-24 22:51:12.501008	f
2119	4789	388f55c3-52e1-499f-8a56-948636a8c205	1.718262e+06	2	2.1478275e+06	t	2026-01-24 22:51:12.918519	f
2120	4789	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.804176e+06	2	2.25522e+06	t	2026-01-24 22:51:13.365243	f
2121	4789	388f55c3-52e1-499f-8a56-948636a8c205	1.894385e+06	2	2.3679812e+06	t	2026-01-24 22:51:13.85602	f
2122	4789	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.989105e+06	2	2.4863812e+06	t	2026-01-24 22:51:14.345704	f
2123	4789	388f55c3-52e1-499f-8a56-948636a8c205	2.088561e+06	2	2.6107012e+06	t	2026-01-24 22:51:14.832955	f
2124	4789	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.19299e+06	2	2.7412375e+06	t	2026-01-24 22:51:15.338347	f
2125	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.140231e+06	2	1.4252888e+06	t	2026-01-24 23:37:03.170759	f
2126	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.496554e+06	1	1.496554e+06	t	2026-01-24 23:37:03.60959	f
2127	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.257106e+06	2	1.5713825e+06	t	2026-01-24 23:37:32.531002	f
2128	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.649952e+06	1	1.649952e+06	t	2026-01-24 23:37:32.957865	f
2129	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.38596e+06	2	1.73245e+06	t	2026-01-24 23:37:33.331921	f
2130	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.819073e+06	1	1.819073e+06	t	2026-01-24 23:37:33.719157	f
2131	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.910027e+06	1	1.910027e+06	t	2026-01-24 23:38:29.944643	f
2132	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.005529e+06	1	2.005529e+06	t	2026-01-24 23:38:30.35884	f
2133	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.105806e+06	1	2.105806e+06	t	2026-01-24 23:38:30.721625	f
2134	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.211097e+06	1	2.211097e+06	t	2026-01-24 23:38:31.09822	f
2135	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.321652e+06	1	2.321652e+06	t	2026-01-24 23:38:31.464792	f
2136	4740	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.437735e+06	1	2.437735e+06	t	2026-01-24 23:38:31.824601	f
2137	4740	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.559622e+06	1	2.559622e+06	t	2026-01-24 23:38:32.185857	f
2138	4746	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.039473e+06	1	1.039473e+06	f	2026-01-25 00:46:50.256013	f
2139	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	873158	2	1.0914475e+06	t	2026-01-25 00:46:50.672946	f
2140	4738	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	1	400000	t	2026-01-25 00:57:44.426781	f
2141	4719	5084741d-1673-42b3-a8e3-3d422874e814	7.990751e+06	5	1.2385664e+07	f	2026-01-25 01:14:29.418827	f
2142	4719	02538c92-2a46-43e6-8351-33297d6de099	8.390289e+06	5	1.3004948e+07	f	2026-01-25 02:01:35.842891	f
2143	4729	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.721597e+07	2	2.1519962e+07	t	2026-01-25 02:16:01.793622	f
2144	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.259596e+07	1	2.259596e+07	t	2026-01-25 02:16:02.222414	f
2145	4729	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.8980608e+07	2	2.3725758e+07	t	2026-01-25 02:16:02.769921	f
2146	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.4912046e+07	1	2.4912046e+07	t	2026-01-25 02:16:03.140364	f
2147	4729	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2.092612e+07	2	2.6157648e+07	t	2026-01-25 02:16:43.950435	f
2148	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2.7465532e+07	1	2.7465532e+07	t	2026-01-25 02:16:44.382191	f
2149	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.571749e+06	2	5.714686e+06	t	2026-01-25 02:16:44.421722	f
2150	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.800337e+06	2	6.000421e+06	t	2026-01-25 02:16:44.822698	f
2151	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.040354e+06	2	6.3004425e+06	t	2026-01-25 02:16:45.199963	f
2152	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.292372e+06	2	6.615465e+06	t	2026-01-25 02:16:45.583814	f
2153	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.556991e+06	2	6.946239e+06	t	2026-01-25 02:16:45.953536	f
2154	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.834841e+06	2	7.293551e+06	t	2026-01-25 02:16:46.32307	f
2155	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.126583e+06	2	7.658229e+06	t	2026-01-25 02:16:46.688416	f
2156	4729	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.8838808e+07	1	2.8838808e+07	t	2026-01-25 02:17:12.069825	f
2157	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.0280748e+07	1	3.0280748e+07	t	2026-01-25 02:17:12.510566	f
2158	4729	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.5435828e+07	2	3.1794786e+07	t	2026-01-25 02:18:00.350078	f
2159	4729	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	3.3384526e+07	1	3.3384526e+07	t	2026-01-25 02:18:00.824338	f
2160	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	6.045971e+06	3	8.0411415e+06	t	2026-01-25 02:19:52.013245	f
2161	4724	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.754559e+06	2	8.443199e+06	t	2026-01-25 02:19:52.442229	f
2162	4724	17faf686-27d1-4e30-a11c-4e7ec21ca685	6.665684e+06	3	8.86536e+06	t	2026-01-25 02:19:52.823083	f
2163	4738	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	2	500000	f	2026-01-25 02:29:56.314631	f
2164	4756	c4815f14-1981-43aa-b972-5f7a43ed0f13	3.705145e+06	1	3.705145e+06	f	2026-01-25 02:58:59.250138	f
2165	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.960304e+06	2	4.95038e+06	t	2026-01-25 03:12:52.231563	f
2166	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	400000	1	400000	t	2026-01-25 03:32:51.93908	f
2167	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	600000	2	750000	t	2026-01-25 13:29:03.005306	f
2168	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.500055e+06	3	1.9950731e+06	t	2026-01-25 14:07:09.065795	f
2169	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	400000	2	500000	t	2026-01-25 14:07:10.654827	f
2170	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	3	532000	t	2026-01-25 14:11:10.065438	f
2171	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	630000	2	787500	f	2026-01-25 14:15:26.467274	f
2172	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	661500	2	826875	t	2026-01-25 14:15:27.05338	f
2173	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	694575	2	868218.75	f	2026-01-25 14:15:36.482652	f
2174	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	729304	2	911630	t	2026-01-25 14:15:37.069824	f
2175	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.214915e+06	3	4.275837e+06	t	2026-01-25 14:20:27.06343	f
2176	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.214915e+06	4	4.5973285e+06	t	2026-01-25 14:20:27.785746	f
2177	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	3.62947e+06	3	4.827195e+06	t	2026-01-25 14:20:28.336	f
2178	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.544444e+06	4	5.068555e+06	t	2026-01-25 14:20:28.930449	f
2179	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.001491e+06	3	5.321983e+06	t	2026-01-25 14:20:29.420925	f
2802	4823	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	486203	2	607753.75	t	2026-01-28 02:06:45.837081	f
2180	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	400000	2	500000	t	2026-01-25 14:20:29.611186	f
2183	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.411645e+06	3	5.867488e+06	t	2026-01-25 14:20:32.023707	f
2194	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.912029e+06	3	7.8629985e+06	t	2026-01-25 14:21:09.669083	f
2195	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.773531e+06	4	8.2561495e+06	t	2026-01-25 14:21:19.667795	f
2196	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.518013e+06	3	8.668957e+06	t	2026-01-25 14:21:27.969069	f
2197	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	6.365319e+06	4	9.102406e+06	t	2026-01-25 14:21:42.466722	f
2198	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.18611e+06	3	9.557526e+06	t	2026-01-25 14:21:52.267418	f
2199	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	7.017764e+06	4	1.0035403e+07	t	2026-01-25 14:22:07.33088	f
2803	4823	c532b6f7-bdfb-4505-b43f-f653770c03af	1e+06	1	1e+06	f	2026-01-28 02:06:58.281668	f
2181	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	3.90775e+06	4	5.5880825e+06	t	2026-01-25 14:20:29.883421	f
2184	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-25 14:20:32.288437	f
2185	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.308296e+06	4	6.1608635e+06	t	2026-01-25 14:20:32.518805	f
2202	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	8.734763e+06	3	1.1617235e+07	t	2026-01-25 14:22:17.606422	f
2203	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	8.530138e+06	4	1.2198097e+07	t	2026-01-25 14:22:18.128421	f
2804	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2.2e+06	3	2.926e+06	f	2026-01-28 02:09:44.518893	f
2182	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	525000	1	525000	t	2026-01-25 14:20:31.692393	f
2186	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	578813	1	578813	t	2026-01-25 14:20:32.795652	f
2188	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-25 14:20:33.239892	f
2189	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.749897e+06	4	6.7923525e+06	t	2026-01-25 14:20:33.388019	f
2190	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	638142	1	638142	t	2026-01-25 14:20:33.668074	f
2192	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-25 14:20:50.967992	f
2805	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.0020248e+07	3	2.662693e+07	t	2026-01-28 02:19:49.973288	f
2806	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.102126e+07	3	2.7958278e+07	t	2026-01-28 02:19:50.435074	f
2807	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.2072324e+07	3	2.9356192e+07	t	2026-01-28 02:19:50.830011	f
2187	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	4.86384e+06	3	6.468907e+06	t	2026-01-25 14:20:32.976956	f
2191	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	5.362384e+06	3	7.1319705e+06	t	2026-01-25 14:20:41.56753	f
2193	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.236762e+06	4	7.4885695e+06	t	2026-01-25 14:20:59.269061	f
2200	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.922687e+06	3	1.0537174e+07	t	2026-01-25 14:22:07.97127	f
2201	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	7.737086e+06	4	1.1064033e+07	t	2026-01-25 14:22:16.866463	f
2204	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.630077e+06	3	1.2808002e+07	t	2026-01-25 14:22:18.691617	f
2205	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	9.404477e+06	4	1.3448402e+07	t	2026-01-25 14:22:24.568023	f
2206	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.061716e+07	3	1.4120823e+07	t	2026-01-25 14:22:32.876966	f
2207	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.0368437e+07	4	1.4826865e+07	t	2026-01-25 14:22:33.444518	f
2208	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.170542e+07	3	1.5568209e+07	t	2026-01-25 14:22:33.990501	f
2209	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.170542e+07	3	1.5568209e+07	t	2026-01-25 14:22:34.009759	f
2210	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.2290692e+07	3	1.634662e+07	t	2026-01-25 14:22:34.500142	f
2212	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	562842	2	703552.5	t	2026-01-25 14:22:36.80637	f
2213	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	400000	2	500000	t	2026-01-25 14:31:38.068763	f
2214	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	400000	3	532000	t	2026-01-25 14:31:53.166457	f
2215	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	765770	2	957212.5	t	2026-01-25 15:00:16.55424	f
2216	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	804059	2	1.00507375e+06	t	2026-01-25 15:00:16.978309	f
2217	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	844262	2	1.0553275e+06	t	2026-01-25 15:00:17.347244	f
2218	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	886476	2	1.108095e+06	t	2026-01-25 15:00:17.727555	f
2219	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	930800	2	1.1635e+06	t	2026-01-25 15:00:18.102138	f
2220	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	977340	2	1.221675e+06	t	2026-01-25 15:00:18.466179	f
2221	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	1.026207e+06	2	1.2827588e+06	t	2026-01-25 15:00:18.830491	f
2222	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.077518e+06	2	1.3468975e+06	t	2026-01-25 15:00:19.210464	f
2223	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	1.131394e+06	2	1.4142425e+06	t	2026-01-25 15:00:19.586913	f
2224	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.187964e+06	2	1.484955e+06	t	2026-01-25 15:00:19.959384	f
2225	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	1.247363e+06	2	1.5592038e+06	t	2026-01-25 15:00:20.324955	f
2226	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.309732e+06	2	1.637165e+06	t	2026-01-25 15:00:20.684978	f
2227	4756	6f591686-4009-4693-a2c7-d3eb1b36073f	3.262117e+06	2	4.0776462e+06	t	2026-01-25 15:02:02.841466	f
2228	4756	02538c92-2a46-43e6-8351-33297d6de099	4.281529e+06	1	4.281529e+06	f	2026-01-25 15:38:51.217751	f
2229	4756	6f591686-4009-4693-a2c7-d3eb1b36073f	3.596485e+06	2	4.495606e+06	t	2026-01-25 15:38:51.941707	f
2230	4756	02538c92-2a46-43e6-8351-33297d6de099	4.720387e+06	1	4.720387e+06	f	2026-01-25 15:40:45.898932	f
2231	4756	6f591686-4009-4693-a2c7-d3eb1b36073f	3.965126e+06	2	4.9564075e+06	t	2026-01-25 15:40:46.477051	f
2232	4756	02538c92-2a46-43e6-8351-33297d6de099	4.163383e+06	2	5.204229e+06	f	2026-01-25 15:41:05.578952	f
2233	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	795244	1	795244	t	2026-01-25 16:20:21.830498	f
2234	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	835007	1	835007	t	2026-01-25 16:20:22.451222	f
2235	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	876758	1	876758	t	2026-01-25 16:20:23.07969	f
2236	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	920596	1	920596	t	2026-01-25 16:20:23.6467	f
2237	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	966626	1	966626	t	2026-01-25 16:20:24.229632	f
2238	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.014958e+06	1	1.014958e+06	t	2026-01-25 16:20:24.7934	f
2239	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.065706e+06	1	1.065706e+06	t	2026-01-25 16:20:25.356306	f
2240	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.118992e+06	1	1.118992e+06	t	2026-01-25 16:20:25.891316	f
2241	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.174942e+06	1	1.174942e+06	t	2026-01-25 16:20:26.433719	f
2242	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.23369e+06	1	1.23369e+06	t	2026-01-25 16:20:26.908508	f
2243	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.295375e+06	1	1.295375e+06	t	2026-01-25 16:20:27.426684	f
2244	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.360144e+06	1	1.360144e+06	t	2026-01-25 16:20:27.964905	f
2245	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.428152e+06	1	1.428152e+06	t	2026-01-25 16:20:28.501433	f
2246	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	420000	1	420000	t	2026-01-25 16:29:54.18316	f
2247	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	441000	1	441000	t	2026-01-25 16:29:54.687157	f
2248	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	463050	1	463050	t	2026-01-25 16:29:55.151551	f
2249	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	486203	1	486203	t	2026-01-25 16:29:55.617793	f
2250	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	510514	1	510514	t	2026-01-25 16:29:56.085873	f
2251	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	536040	1	536040	t	2026-01-25 16:29:56.570098	f
2252	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	562842	1	562842	t	2026-01-25 16:29:57.036695	f
2253	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	590985	1	590985	t	2026-01-25 16:29:57.502958	f
2254	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	620535	1	620535	t	2026-01-25 16:29:57.978334	f
2255	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	651562	1	651562	t	2026-01-25 16:29:58.472511	f
2256	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	684141	1	684141	t	2026-01-25 16:29:58.947542	f
2257	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	718349	1	718349	t	2026-01-25 16:29:59.387216	f
2258	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	754267	1	754267	t	2026-01-25 16:29:59.828896	f
2259	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	791981	1	791981	t	2026-01-25 16:30:00.266997	f
2260	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	831581	1	831581	t	2026-01-25 16:30:00.702229	f
2261	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	873161	1	873161	t	2026-01-25 16:30:01.144294	f
2262	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	916820	1	916820	t	2026-01-25 16:30:01.565401	f
2263	4757	889cd08b-6e70-4f4c-847f-363dbbe2c110	962661	1	962661	t	2026-01-25 16:30:02.021743	f
2264	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.010795e+06	1	1.010795e+06	t	2026-01-25 16:30:02.436953	f
2265	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.039473e+06	1	1.039473e+06	t	2026-01-25 16:41:22.504054	f
2266	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	873158	2	1.0914475e+06	t	2026-01-25 16:41:22.928845	f
2267	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.14602e+06	1	1.14602e+06	t	2026-01-25 16:41:23.304006	f
2268	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	962657	2	1.2033212e+06	t	2026-01-25 16:41:23.664325	f
2269	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.263488e+06	1	1.263488e+06	t	2026-01-25 16:41:24.029986	f
2270	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.06133e+06	2	1.3266625e+06	t	2026-01-25 16:44:18.231692	f
2271	4748	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.392996e+06	1	1.392996e+06	t	2026-01-25 16:44:18.663578	f
2272	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.170117e+06	2	1.4626462e+06	t	2026-01-25 16:44:19.041327	f
2273	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	500000	2	625000	t	2026-01-25 16:58:45.886157	f
2274	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	656250	1	656250	t	2026-01-25 16:58:46.31084	f
2275	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	551250	2	689062.5	t	2026-01-25 16:58:46.697498	f
2276	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	723516	1	723516	t	2026-01-25 16:58:47.088437	f
2277	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	607754	2	759692.5	t	2026-01-25 16:58:47.466822	f
2278	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	797678	1	797678	t	2026-01-25 16:58:47.857386	f
2279	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	670050	2	837562.5	t	2026-01-25 16:58:48.25134	f
2280	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	879441	1	879441	t	2026-01-25 16:58:48.622652	f
2281	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	738731	2	923413.75	t	2026-01-25 16:58:48.998078	f
2282	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	969585	1	969585	t	2026-01-25 16:58:49.36985	f
2283	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	814452	2	1.018065e+06	t	2026-01-25 16:58:49.73916	f
2284	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.068969e+06	1	1.068969e+06	t	2026-01-25 16:58:50.111312	f
2285	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	897934	2	1.1224175e+06	t	2026-01-25 16:58:50.481138	f
2286	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.178539e+06	1	1.178539e+06	t	2026-01-25 16:58:50.859726	f
2287	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	989973	2	1.2374662e+06	t	2026-01-25 16:58:51.234506	f
2288	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.29934e+06	1	1.29934e+06	t	2026-01-25 16:58:51.617914	f
2289	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.091446e+06	2	1.3643075e+06	t	2026-01-25 17:01:04.277623	f
2290	4793	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.432523e+06	1	1.432523e+06	t	2026-01-25 17:01:04.710957	f
2291	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.20332e+06	2	1.50415e+06	t	2026-01-25 17:01:05.118108	f
2292	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	1.575058e+06	3	2.0948271e+06	t	2026-01-25 17:05:01.262099	f
2293	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.653811e+06	3	2.1995688e+06	t	2026-01-25 17:05:01.697236	f
2294	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	1.736502e+06	3	2.3095478e+06	t	2026-01-25 17:05:02.091716	f
2295	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.823328e+06	3	2.4250262e+06	t	2026-01-25 17:05:02.457176	f
2296	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	1.914495e+06	3	2.5462782e+06	t	2026-01-25 17:05:02.861497	f
2297	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.01022e+06	3	2.6735925e+06	t	2026-01-25 17:05:03.265872	f
2298	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	2.110731e+06	3	2.8072722e+06	t	2026-01-25 17:05:03.636399	f
2299	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.216268e+06	3	2.9476365e+06	t	2026-01-25 17:05:04.031578	f
2300	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	2.327082e+06	3	3.095019e+06	t	2026-01-25 17:05:04.402991	f
2301	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.443437e+06	3	3.2497712e+06	t	2026-01-25 17:05:04.77317	f
2302	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	2.565609e+06	3	3.41226e+06	t	2026-01-25 17:05:05.178786	f
2303	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.69389e+06	3	3.5828738e+06	t	2026-01-25 17:05:05.562533	f
2304	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	2.828585e+06	3	3.762018e+06	t	2026-01-25 17:05:05.945664	f
2305	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.970015e+06	3	3.95012e+06	t	2026-01-25 17:05:06.334911	f
2306	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	3.118516e+06	3	4.1476262e+06	t	2026-01-25 17:06:50.948544	f
2307	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.274442e+06	3	4.355008e+06	t	2026-01-25 17:06:51.368643	f
2308	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	3.438165e+06	3	4.5727595e+06	t	2026-01-25 17:06:51.734741	f
2309	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.610074e+06	3	4.8013985e+06	t	2026-01-25 17:06:52.121282	f
2310	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	3.790578e+06	3	5.0414685e+06	t	2026-01-25 17:07:54.52681	f
2311	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.980107e+06	3	5.2935425e+06	t	2026-01-25 17:07:54.95741	f
2312	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	4.179113e+06	3	5.5582205e+06	t	2026-01-25 17:07:55.328209	f
2313	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.388069e+06	3	5.836132e+06	t	2026-01-25 19:17:01.479866	f
2314	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.199648e+06	2	1.49956e+06	t	2026-01-25 19:18:45.078105	f
2315	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.574538e+06	1	1.574538e+06	t	2026-01-25 19:18:46.007108	f
2316	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.322612e+06	2	1.653265e+06	t	2026-01-25 19:18:46.84199	f
2317	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.735929e+06	1	1.735929e+06	t	2026-01-25 19:18:47.659283	f
2318	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.458181e+06	2	1.8227262e+06	t	2026-01-25 19:18:48.391117	f
2319	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.913863e+06	1	1.913863e+06	t	2026-01-25 19:18:49.15936	f
2320	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.607645e+06	2	2.0095562e+06	t	2026-01-25 19:18:49.970919	f
2321	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.110035e+06	1	2.110035e+06	t	2026-01-25 19:18:50.731245	f
2322	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.77243e+06	2	2.2155375e+06	t	2026-01-25 19:20:31.331977	f
2323	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.326315e+06	1	2.326315e+06	t	2026-01-25 19:20:32.0862	f
2324	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.954105e+06	2	2.4426312e+06	t	2026-01-25 19:20:32.714841	f
2325	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.564763e+06	1	2.564763e+06	t	2026-01-25 19:20:33.357148	f
2326	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	4.15832e+06	2	5.1979e+06	t	2026-01-25 21:57:08.175412	f
2327	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.366236e+06	2	5.457795e+06	t	2026-01-25 21:57:10.179027	f
2328	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	4.584548e+06	2	5.730685e+06	t	2026-01-25 21:57:12.200094	f
2329	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	4.813776e+06	2	6.01722e+06	t	2026-01-25 21:57:14.062915	f
2330	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	5.054465e+06	2	6.318081e+06	t	2026-01-25 21:57:15.892769	f
2331	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.307189e+06	2	6.633986e+06	t	2026-01-25 21:57:17.65957	f
2332	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	5.572549e+06	2	6.965686e+06	t	2026-01-25 21:57:19.516749	f
2333	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	5.851177e+06	2	7.313971e+06	t	2026-01-25 21:57:21.373975	f
2334	4767	6f591686-4009-4693-a2c7-d3eb1b36073f	6.143736e+06	2	7.67967e+06	f	2026-01-25 21:57:47.996082	f
2335	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.2002763e+07	4	1.7163952e+07	t	2026-01-26 00:17:34.599949	f
2336	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.3550489e+07	3	1.802215e+07	t	2026-01-26 00:17:35.028764	f
2337	4832	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.3233048e+07	4	1.8923258e+07	t	2026-01-26 00:17:35.416854	f
2338	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.4939415e+07	3	1.9869422e+07	t	2026-01-26 00:17:35.814384	f
2339	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.154401e+06	2	2.6930012e+06	t	2026-01-26 00:24:23.273647	f
2340	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.827652e+06	1	2.827652e+06	t	2026-01-26 00:24:23.724909	f
2341	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.375228e+06	2	2.969035e+06	t	2026-01-26 00:24:24.140503	f
2342	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.117487e+06	1	3.117487e+06	t	2026-01-26 00:24:24.538625	f
2343	4802	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	600000	3	798000	f	2026-01-26 00:30:33.622171	f
2344	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.14602e+06	1	1.14602e+06	t	2026-01-26 00:34:15.411559	f
2345	4746	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	962657	2	1.2033212e+06	t	2026-01-26 00:34:16.140079	f
2346	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.263488e+06	1	1.263488e+06	t	2026-01-26 00:34:16.730085	f
2347	4802	c4815f14-1981-43aa-b972-5f7a43ed0f13	837900	1	837900	f	2026-01-26 00:39:10.343158	f
2349	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.61869e+06	2	3.2733625e+06	t	2026-01-26 00:44:18.733767	f
2350	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.437031e+06	1	3.437031e+06	t	2026-01-26 00:44:19.273064	f
2351	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.887107e+06	2	3.6088838e+06	t	2026-01-26 00:44:47.62648	f
2352	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.789328e+06	1	3.789328e+06	t	2026-01-26 00:44:48.075825	f
2353	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.183036e+06	2	3.978795e+06	t	2026-01-26 00:50:49.019027	f
2354	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4.177735e+06	1	4.177735e+06	t	2026-01-26 00:50:49.546781	f
2355	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.509298e+06	2	4.3866225e+06	t	2026-01-26 00:50:50.041562	f
2356	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4.605954e+06	1	4.605954e+06	t	2026-01-26 00:50:50.566744	f
2357	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	3.869002e+06	2	4.8362525e+06	t	2026-01-26 00:50:51.063667	f
2358	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.535779e+06	1	1.535779e+06	t	2026-01-26 00:58:20.622599	f
2359	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.290055e+06	2	1.6125688e+06	t	2026-01-26 00:58:21.059446	f
2360	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.693198e+06	1	1.693198e+06	t	2026-01-26 00:58:21.461764	f
2361	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.422287e+06	2	1.7778588e+06	t	2026-01-26 00:58:21.864262	f
2362	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.866752e+06	1	1.866752e+06	t	2026-01-26 00:58:22.338133	f
2363	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.061335e+06	1	1.061335e+06	t	2026-01-26 00:59:28.749509	f
2364	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.114402e+06	1	1.114402e+06	t	2026-01-26 00:59:29.198298	f
2365	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.170123e+06	1	1.170123e+06	t	2026-01-26 00:59:29.579199	f
2366	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.22863e+06	1	1.22863e+06	t	2026-01-26 00:59:30.141085	f
2367	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.290062e+06	1	1.290062e+06	t	2026-01-26 00:59:30.524566	f
2368	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.354566e+06	1	1.354566e+06	t	2026-01-26 00:59:30.905718	f
2369	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.422295e+06	1	1.422295e+06	t	2026-01-26 00:59:31.286424	f
2370	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.49341e+06	1	1.49341e+06	t	2026-01-26 00:59:31.675196	f
2371	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.568081e+06	1	1.568081e+06	t	2026-01-26 00:59:32.087038	f
2372	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.646486e+06	1	1.646486e+06	t	2026-01-26 00:59:32.476564	f
2373	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.728811e+06	1	1.728811e+06	t	2026-01-26 00:59:32.868278	f
2374	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.815252e+06	1	1.815252e+06	t	2026-01-26 00:59:33.25989	f
2375	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.906015e+06	1	1.906015e+06	t	2026-01-26 00:59:33.657864	f
2376	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.001316e+06	1	2.001316e+06	t	2026-01-26 00:59:34.113356	f
2377	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.101382e+06	1	2.101382e+06	t	2026-01-26 00:59:34.498861	f
2378	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.206452e+06	1	2.206452e+06	t	2026-01-26 00:59:34.911401	f
2379	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.316775e+06	1	2.316775e+06	t	2026-01-26 00:59:35.307911	f
2380	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.432614e+06	1	2.432614e+06	t	2026-01-26 00:59:35.724541	f
2381	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.554245e+06	1	2.554245e+06	t	2026-01-26 00:59:36.132439	f
2382	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.681958e+06	1	2.681958e+06	t	2026-01-26 00:59:36.517614	f
2383	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.816056e+06	1	2.816056e+06	t	2026-01-26 00:59:36.929802	f
2384	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.956859e+06	1	2.956859e+06	t	2026-01-26 00:59:37.32324	f
2385	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.104702e+06	1	3.104702e+06	t	2026-01-26 00:59:37.70672	f
2386	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.259938e+06	1	3.259938e+06	t	2026-01-26 00:59:38.094284	f
2387	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.422935e+06	1	3.422935e+06	t	2026-01-26 00:59:38.532307	f
2388	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.594082e+06	1	3.594082e+06	t	2026-01-26 00:59:38.915421	f
2389	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.773787e+06	1	3.773787e+06	t	2026-01-26 00:59:39.316093	f
2390	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	3.962477e+06	1	3.962477e+06	t	2026-01-26 00:59:39.703326	f
2391	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	525000	1	525000	t	2026-01-26 01:00:30.959247	f
2392	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-26 01:00:31.399871	f
2393	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	578813	1	578813	t	2026-01-26 01:00:31.804661	f
2394	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-26 01:00:32.200403	f
2395	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	638142	1	638142	t	2026-01-26 01:00:32.587338	f
2396	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-26 01:00:33.026926	f
2397	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	703553	1	703553	t	2026-01-26 01:00:33.429697	f
2398	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	2	738731.25	t	2026-01-26 01:00:33.818534	f
2399	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	775668	1	775668	t	2026-01-26 01:00:34.233313	f
2400	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	651562	2	814452.5	t	2026-01-26 01:00:34.620553	f
2401	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	855176	1	855176	t	2026-01-26 01:00:35.006082	f
2402	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	718348	2	897935	t	2026-01-26 01:00:35.402568	f
2403	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	942832	1	942832	t	2026-01-26 01:00:35.7901	f
2404	4772	f335b9c3-7d63-44f3-9540-13b1d461ca13	791979	2	989973.75	t	2026-01-26 01:00:36.180696	f
2405	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.039473e+06	1	1.039473e+06	t	2026-01-26 01:00:36.572993	f
2406	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	8.063654e+06	1	8.063654e+06	t	2026-01-26 01:00:55.972717	f
2407	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	6.77347e+06	2	8.466838e+06	t	2026-01-26 01:00:56.632385	f
2408	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	8.89018e+06	1	8.89018e+06	t	2026-01-26 01:00:57.249729	f
2409	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	7.467752e+06	2	9.33469e+06	t	2026-01-26 01:00:57.829651	f
2410	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	9.801425e+06	1	9.801425e+06	t	2026-01-26 01:00:58.38149	f
2411	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	8.233197e+06	2	1.0291496e+07	t	2026-01-26 01:00:58.937368	f
2412	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.0806071e+07	1	1.0806071e+07	t	2026-01-26 01:00:59.450388	f
2413	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.464441e+06	1	5.464441e+06	t	2026-01-26 01:01:26.193405	f
2414	4774	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.078066e+06	1	5.078066e+06	t	2026-01-26 01:02:38.034553	f
2415	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.568072e+06	2	1.96009e+06	f	2026-01-26 01:13:29.214289	f
2416	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.058095e+06	1	2.058095e+06	t	2026-01-26 01:13:29.807122	f
2417	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.719024e+06	1	1.719024e+06	t	2026-01-26 01:20:33.550044	f
2418	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.443981e+06	2	1.8049762e+06	t	2026-01-26 01:20:34.0292	f
2419	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.516181e+06	2	1.8952262e+06	t	2026-01-26 01:21:01.359389	f
2420	4767	0477609b-080d-4cd2-b891-117e615bdf47	1.1346375e+07	1	1.1346375e+07	f	2026-01-26 01:29:11.861952	f
2421	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.1913694e+07	1	1.1913694e+07	t	2026-01-26 01:29:12.302839	f
2422	4767	0477609b-080d-4cd2-b891-117e615bdf47	1.2509379e+07	1	1.2509379e+07	f	2026-01-26 01:29:25.720048	f
2423	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	525000	1	525000	f	2026-01-26 01:34:48.067175	f
2424	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	2	551250	t	2026-01-26 01:34:48.516325	f
2425	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	578813	1	578813	f	2026-01-26 01:34:53.849795	f
2426	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	2	607753.75	t	2026-01-26 01:34:54.303936	f
2427	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	638142	1	638142	f	2026-01-26 01:35:00.001888	f
2428	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	2	670050	t	2026-01-26 01:35:00.453447	f
2429	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	703553	1	703553	f	2026-01-26 01:35:08.510552	f
2430	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	2	738731.25	t	2026-01-26 01:35:08.957973	f
2431	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	775668	1	775668	f	2026-01-26 01:35:14.20785	f
2432	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	651562	2	814452.5	t	2026-01-26 01:35:14.648272	f
2433	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.265576e+06	2	5.33197e+06	t	2026-01-26 01:36:06.02568	f
2434	4774	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.598569e+06	1	5.598569e+06	t	2026-01-26 01:36:06.471793	f
2435	4827	5d77ac22-c768-4d3b-99d8-73c250a3e859	738731	1	738731	f	2026-01-26 01:36:17.182422	f
2436	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	620535	2	775668.75	t	2026-01-26 01:36:17.625145	f
2437	4827	5d77ac22-c768-4d3b-99d8-73c250a3e859	950000	1	950000	f	2026-01-26 01:36:34.221921	f
2438	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.702798e+06	2	5.8784975e+06	t	2026-01-26 01:36:41.168067	f
2439	4774	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.172423e+06	1	6.172423e+06	t	2026-01-26 01:36:41.625036	f
2440	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	800000	1	800000	f	2026-01-26 01:38:39.733929	f
2441	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	631579	3	840000.06	t	2026-01-26 01:38:40.256687	f
2442	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	1e+06	1	1e+06	f	2026-01-26 01:38:51.669216	f
2443	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	789474	3	1.0500004e+06	t	2026-01-26 01:38:52.149854	f
2444	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	855176	1	855176	f	2026-01-26 01:42:15.309536	f
2445	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	718348	2	897935	t	2026-01-26 01:42:15.82042	f
2446	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	1e+06	1	1e+06	f	2026-01-26 01:42:32.398976	f
2447	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.590131e+06	2	5.737664e+06	t	2026-01-26 01:45:24.075651	f
2448	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.024548e+06	1	6.024548e+06	t	2026-01-26 01:45:24.539135	f
2449	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.060621e+06	2	6.325776e+06	t	2026-01-26 01:45:24.931748	f
2450	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.642065e+06	1	6.642065e+06	t	2026-01-26 01:45:25.328658	f
2451	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.579335e+06	2	6.974169e+06	t	2026-01-26 01:45:45.704019	f
2452	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	7.322878e+06	1	7.322878e+06	t	2026-01-26 01:45:46.374176	f
2453	4746	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.326663e+06	1	1.326663e+06	f	2026-01-26 01:45:57.681994	f
2454	4746	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.392997e+06	1	1.392997e+06	t	2026-01-26 01:45:58.131324	f
2455	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.78122e+06	3	7.6890225e+06	t	2026-01-26 01:47:53.822347	f
2456	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	8.073474e+06	1	8.073474e+06	t	2026-01-26 01:47:54.280707	f
2457	4748	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.161e+06	1	2.161e+06	f	2026-01-26 01:48:00.721332	f
2458	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.26905e+06	1	2.26905e+06	t	2026-01-26 01:48:01.174534	f
2459	4756	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.373796e+06	3	8.477149e+06	t	2026-01-26 01:48:12.51887	f
2460	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	8.901007e+06	1	8.901007e+06	t	2026-01-26 01:48:12.969142	f
2461	4746	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.462647e+06	1	1.462647e+06	f	2026-01-26 01:48:23.971603	f
2462	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.3134848e+07	1	1.3134848e+07	t	2026-01-26 01:50:58.112463	f
2463	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	1.906002e+06	2	2.3825025e+06	t	2026-01-26 01:52:35.074206	f
2464	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.501628e+06	1	2.501628e+06	t	2026-01-26 01:52:35.531132	f
2465	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	2.101368e+06	2	2.62671e+06	t	2026-01-26 01:52:35.956399	f
2466	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.758046e+06	1	2.758046e+06	t	2026-01-26 01:52:36.345736	f
2467	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	2.316759e+06	2	2.8959488e+06	t	2026-01-26 01:52:36.777562	f
2468	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.040747e+06	1	3.040747e+06	t	2026-01-26 01:52:37.161382	f
2469	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	2.554228e+06	2	3.192785e+06	f	2026-01-26 01:52:58.30862	f
2470	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.352425e+06	1	3.352425e+06	t	2026-01-26 01:52:58.816829	f
2471	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	2.816037e+06	2	3.5200462e+06	f	2026-01-26 01:53:05.974335	f
2472	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.696049e+06	1	3.696049e+06	t	2026-01-26 01:53:06.414627	f
2473	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	3.104682e+06	2	3.8808525e+06	f	2026-01-26 01:53:18.998145	f
2474	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.074896e+06	1	4.074896e+06	t	2026-01-26 01:53:19.440093	f
2475	4748	6f591686-4009-4693-a2c7-d3eb1b36073f	3.422913e+06	2	4.278641e+06	f	2026-01-26 01:54:56.06311	f
2476	4748	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.492574e+06	1	4.492574e+06	t	2026-01-26 01:54:56.518954	f
2477	4756	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	9.346058e+06	1	9.346058e+06	t	2026-01-26 01:57:59.435463	f
2478	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	3.202879e+06	4	4.580117e+06	f	2026-01-26 02:01:08.288549	f
2479	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.363023e+06	4	4.809123e+06	t	2026-01-26 02:01:08.725935	f
2480	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.160601e+06	1	4.160601e+06	t	2026-01-26 02:01:14.215709	f
2481	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4.368632e+06	1	4.368632e+06	t	2026-01-26 02:01:14.653057	f
2482	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	4.587064e+06	1	4.587064e+06	t	2026-01-26 02:01:15.036427	f
2483	4757	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	4.816418e+06	1	4.816418e+06	t	2026-01-26 02:01:15.416255	f
2484	4757	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	5.057239e+06	1	5.057239e+06	t	2026-01-26 02:01:15.79661	f
2485	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	3.531175e+06	4	5.04958e+06	t	2026-01-26 02:04:04.725243	f
2486	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	3.707734e+06	4	5.3020595e+06	t	2026-01-26 02:04:05.18028	f
2487	4759	6f591686-4009-4693-a2c7-d3eb1b36073f	3.893121e+06	4	5.567163e+06	t	2026-01-26 02:04:05.563604	f
2488	4759	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4.087778e+06	4	5.8455225e+06	t	2026-01-26 02:04:05.949991	f
2489	4772	6f591686-4009-4693-a2c7-d3eb1b36073f	873158	2	1.0914475e+06	f	2026-01-26 02:08:41.546521	f
2490	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.14602e+06	1	1.14602e+06	t	2026-01-26 02:08:42.022121	f
2491	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	9.813361e+06	1	9.813361e+06	t	2026-01-26 02:09:42.492509	f
2492	4756	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.030403e+07	1	1.030403e+07	t	2026-01-26 02:09:42.931816	f
2493	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.0819232e+07	1	1.0819232e+07	t	2026-01-26 02:09:43.332839	f
2494	4756	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.1360194e+07	1	1.1360194e+07	t	2026-01-26 02:09:43.727091	f
2495	4756	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.1928204e+07	1	1.1928204e+07	t	2026-01-26 02:09:44.10787	f
2496	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.591991e+06	2	1.9899888e+06	t	2026-01-26 02:11:59.700304	f
2497	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.671591e+06	2	2.0894888e+06	t	2026-01-26 02:12:00.144626	f
2498	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.755171e+06	2	2.1939638e+06	t	2026-01-26 02:12:00.545171	f
2499	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.84293e+06	2	2.3036625e+06	t	2026-01-26 02:12:00.954912	f
2500	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	1.935077e+06	2	2.4188462e+06	t	2026-01-26 02:12:01.389135	f
2501	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	2.031831e+06	2	2.5397888e+06	t	2026-01-26 02:15:45.743802	f
2502	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	2.133423e+06	2	2.6667788e+06	t	2026-01-26 02:15:46.204164	f
2503	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	2.240095e+06	2	2.8001188e+06	t	2026-01-26 02:15:46.591387	f
2504	4770	cc78d40c-9179-4616-9834-9aa9c69963fa	2.3521e+06	2	2.940125e+06	t	2026-01-26 02:15:47.010351	f
2505	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	2.469705e+06	2	3.0871312e+06	t	2026-01-26 02:15:47.402226	f
2506	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	5.184836e+06	2	6.481045e+06	t	2026-01-26 02:20:21.885292	f
2507	4774	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	6.805098e+06	1	6.805098e+06	t	2026-01-26 02:20:22.325383	f
2508	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	5.716283e+06	2	7.145354e+06	t	2026-01-26 02:20:22.716461	f
2509	4774	d8be0952-18cc-4082-8a6c-5de14ea569ce	6.002098e+06	2	7.5026225e+06	t	2026-01-26 02:23:28.864281	f
2510	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.593191e+06	2	3.2414888e+06	t	2026-01-26 02:26:20.764841	f
2511	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	2.722851e+06	2	3.4035638e+06	t	2026-01-26 02:26:21.210664	f
2512	4770	889cd08b-6e70-4f4c-847f-363dbbe2c110	2.858994e+06	2	3.5737425e+06	t	2026-01-26 02:26:37.235186	f
2513	4770	6f591686-4009-4693-a2c7-d3eb1b36073f	3.001944e+06	2	3.75243e+06	f	2026-01-26 02:27:29.75898	f
2514	4772	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.203321e+06	1	1.203321e+06	t	2026-01-26 02:28:53.257346	f
2515	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.263488e+06	1	1.263488e+06	t	2026-01-26 02:28:53.702944	f
2516	4772	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.326663e+06	1	1.326663e+06	t	2026-01-26 02:28:54.088919	f
2517	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.392997e+06	1	1.392997e+06	t	2026-01-26 02:28:54.472173	f
2518	4772	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.462647e+06	1	1.462647e+06	t	2026-01-26 02:29:12.205187	f
2519	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.53578e+06	1	1.53578e+06	t	2026-01-26 02:29:12.621358	f
2520	4774	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	7.877754e+06	1	7.877754e+06	t	2026-01-26 02:29:47.155977	f
2521	4772	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.612569e+06	1	1.612569e+06	t	2026-01-26 02:29:49.377307	f
2522	4772	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.693198e+06	1	1.693198e+06	t	2026-01-26 02:29:49.801271	f
2523	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.1033273e+07	2	1.3791591e+07	t	2026-01-26 02:29:52.697104	f
2524	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.4481171e+07	1	1.4481171e+07	t	2026-01-26 02:29:53.145301	f
2525	4767	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.2164184e+07	2	1.520523e+07	t	2026-01-26 02:29:53.559521	f
2526	4767	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.5965492e+07	1	1.5965492e+07	t	2026-01-26 02:29:53.96523	f
2527	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	865329	1	865329	t	2026-01-26 02:33:23.601707	f
2528	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	726877	2	908596.25	t	2026-01-26 02:33:24.111462	f
2529	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	954027	1	954027	t	2026-01-26 02:33:24.527506	f
2530	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	801383	2	1.00172875e+06	t	2026-01-26 02:33:24.929855	f
2531	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.051816e+06	1	1.051816e+06	t	2026-01-26 02:33:25.325111	f
2532	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	840000	2	1.05e+06	t	2026-01-26 02:41:58.105717	f
2533	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	798000	2	997500	t	2026-01-26 02:42:53.345636	f
2534	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.047375e+06	1	1.047375e+06	t	2026-01-26 02:47:17.90709	f
2535	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	879795	2	1.0997438e+06	t	2026-01-26 02:47:18.340619	f
2536	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.154731e+06	1	1.154731e+06	t	2026-01-26 02:47:18.791445	f
2537	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	969975	2	1.2124688e+06	t	2026-01-26 02:47:19.228871	f
2538	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.273093e+06	1	1.273093e+06	t	2026-01-26 02:47:19.67894	f
2539	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.069399e+06	2	1.3367488e+06	t	2026-01-26 02:47:20.155422	f
2540	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.403587e+06	1	1.403587e+06	t	2026-01-26 02:47:20.561042	f
2541	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.179014e+06	2	1.4737675e+06	t	2026-01-26 02:47:20.942208	f
2542	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.547456e+06	1	1.547456e+06	t	2026-01-26 02:47:21.326889	f
2543	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.299864e+06	2	1.62483e+06	t	2026-01-26 02:47:21.719926	f
2544	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.706072e+06	1	1.706072e+06	t	2026-01-26 02:47:22.101144	f
2545	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.433101e+06	2	1.7913762e+06	t	2026-01-26 02:47:22.492808	f
2546	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	1.880946e+06	1	1.880946e+06	t	2026-01-26 02:47:22.879463	f
2547	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.579995e+06	2	1.9749938e+06	t	2026-01-26 02:47:23.314955	f
2548	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.073744e+06	1	2.073744e+06	t	2026-01-26 02:48:00.275177	f
2549	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.741945e+06	2	2.1774312e+06	t	2026-01-26 02:48:00.891833	f
2550	4827	17faf686-27d1-4e30-a11c-4e7ec21ca685	2.286303e+06	1	2.286303e+06	t	2026-01-26 02:48:01.443624	f
2551	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.920495e+06	2	2.4006188e+06	t	2026-01-26 02:52:33.448895	f
2552	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.1025e+06	1	1.1025e+06	f	2026-01-26 05:18:05.788861	f
2553	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	926100	2	1.157625e+06	t	2026-01-26 05:18:06.664591	f
2554	4792	5d77ac22-c768-4d3b-99d8-73c250a3e859	420000	1	420000	f	2026-01-26 05:25:16.125285	f
2555	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	441000	1	441000	t	2026-01-26 05:25:16.809606	f
2556	4792	5d77ac22-c768-4d3b-99d8-73c250a3e859	463050	1	463050	f	2026-01-26 05:25:27.175889	f
2557	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	486203	1	486203	t	2026-01-26 05:25:27.754165	f
2558	4792	5d77ac22-c768-4d3b-99d8-73c250a3e859	510514	1	510514	f	2026-01-26 05:25:35.06157	f
2559	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	536040	1	536040	t	2026-01-26 05:25:35.514947	f
2560	4792	5d77ac22-c768-4d3b-99d8-73c250a3e859	562842	1	562842	f	2026-01-26 05:25:43.584849	f
2561	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	590985	1	590985	t	2026-01-26 05:25:44.134021	f
2562	4792	5d77ac22-c768-4d3b-99d8-73c250a3e859	620535	1	620535	f	2026-01-26 05:25:52.2214	f
2563	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	651562	1	651562	t	2026-01-26 05:25:52.769108	f
2564	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	547313	2	684141.25	t	2026-01-26 13:18:56.712704	f
2565	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	718349	1	718349	t	2026-01-26 13:18:57.369518	f
2566	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	603414	2	754267.5	t	2026-01-26 13:18:57.981183	f
2567	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	791981	1	791981	t	2026-01-26 13:18:58.519301	f
2568	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	665265	2	831581.25	t	2026-01-26 13:18:59.056002	f
2569	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	873161	1	873161	t	2026-01-26 13:18:59.562928	f
2570	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	733456	2	916820	t	2026-01-26 13:19:00.087718	f
2571	4792	17faf686-27d1-4e30-a11c-4e7ec21ca685	962661	1	962661	t	2026-01-26 13:19:00.623731	f
2572	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	808636	2	1.010795e+06	t	2026-01-26 13:19:01.137087	f
2573	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	1.263486e+06	2	1.5793575e+06	t	2026-01-26 13:19:39.390241	f
2574	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.326661e+06	2	1.6583262e+06	t	2026-01-26 13:19:39.889593	f
2575	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	1.392995e+06	2	1.7412438e+06	t	2026-01-26 13:19:40.2789	f
2576	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.462645e+06	2	1.8283062e+06	t	2026-01-26 13:19:40.682172	f
2577	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	1.535778e+06	2	1.9197225e+06	t	2026-01-26 13:19:41.080372	f
2578	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.612567e+06	2	2.0157088e+06	t	2026-01-26 13:19:41.471929	f
2579	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	1.693196e+06	2	2.116495e+06	t	2026-01-26 13:19:41.856512	f
2580	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.777856e+06	2	2.22232e+06	t	2026-01-26 13:19:42.268726	f
2581	4793	cc78d40c-9179-4616-9834-9aa9c69963fa	1.866749e+06	2	2.3334362e+06	t	2026-01-26 13:19:42.667497	f
2582	4793	6f591686-4009-4693-a2c7-d3eb1b36073f	1.960087e+06	2	2.4501088e+06	t	2026-01-26 13:19:43.065946	f
2583	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	883526	2	1.1044075e+06	t	2026-01-26 13:22:52.592486	f
2584	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.159628e+06	1	1.159628e+06	t	2026-01-26 13:22:53.035989	f
2585	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	974088	2	1.21761e+06	t	2026-01-26 13:22:53.429147	f
2586	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.278491e+06	1	1.278491e+06	t	2026-01-26 13:22:53.827664	f
2587	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.073933e+06	2	1.3424162e+06	t	2026-01-26 13:22:54.225456	f
2588	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.409538e+06	1	1.409538e+06	t	2026-01-26 13:22:54.613667	f
2589	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.184012e+06	2	1.480015e+06	t	2026-01-26 13:22:55.013866	f
2590	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.554016e+06	1	1.554016e+06	t	2026-01-26 13:22:55.420061	f
2591	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.305374e+06	2	1.6317175e+06	t	2026-01-26 13:22:55.830681	f
2592	4788	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.713304e+06	1	1.713304e+06	t	2026-01-26 13:22:56.226273	f
2593	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.439176e+06	2	1.79897e+06	t	2026-01-26 13:22:56.62925	f
2594	4781	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.1677556e+07	1	1.1677556e+07	t	2026-01-26 15:24:13.169	f
2595	4812	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	400000	1	400000	f	2026-01-26 15:29:27.360699	f
2596	4784	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	400000	2	500000	f	2026-01-26 15:33:33.551672	f
2597	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	9.809148e+06	2	1.2261435e+07	t	2026-01-26 15:41:23.366625	f
2598	4781	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.2874507e+07	1	1.2874507e+07	t	2026-01-26 15:41:23.833356	f
2599	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.0814586e+07	2	1.3518232e+07	t	2026-01-26 15:41:24.237057	f
2601	4790	5084741d-1673-42b3-a8e3-3d422874e814	5.430954e+06	3	7.223169e+06	t	2026-01-26 20:59:30.275688	f
2602	4790	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.067462e+06	2	7.5843275e+06	t	2026-01-26 20:59:31.108695	f
2603	4790	5084741d-1673-42b3-a8e3-3d422874e814	5.987627e+06	3	7.963544e+06	t	2026-01-26 20:59:31.852252	f
2604	4790	5084741d-1673-42b3-a8e3-3d422874e814	6.370836e+06	3	8.473212e+06	t	2026-01-26 20:59:31.865898	f
2605	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	4.607473e+06	3	6.127939e+06	t	2026-01-26 21:28:31.478916	f
2606	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	4.837847e+06	3	6.4343365e+06	t	2026-01-26 21:28:32.090089	f
2607	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	5.07974e+06	3	6.756054e+06	f	2026-01-26 21:28:40.972362	f
2608	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.333727e+06	3	7.093857e+06	t	2026-01-26 22:12:26.698999	f
2609	4802	d8be0952-18cc-4082-8a6c-5de14ea569ce	703836	2	879795	f	2026-01-26 22:21:55.585788	f
2610	4794	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	400000	2	500000	t	2026-01-26 22:29:21.249737	f
2611	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	400000	1	400000	t	2026-01-26 22:31:23.349947	f
2612	4814	6f591686-4009-4693-a2c7-d3eb1b36073f	5.208777e+06	4	7.448551e+06	f	2026-01-26 22:34:46.373916	f
2613	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	5.880435e+06	3	7.8209785e+06	t	2026-01-26 22:34:47.401557	f
2614	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	849068	2	1.061335e+06	f	2026-01-26 23:47:07.25977	f
2615	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	891522	2	1.1144025e+06	t	2026-01-26 23:47:10.197883	f
2616	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	936099	2	1.1701238e+06	f	2026-01-26 23:47:46.088857	f
2617	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	982904	2	1.22863e+06	t	2026-01-26 23:47:48.956316	f
2618	4802	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	739028	2	923785	f	2026-01-26 23:49:14.657085	f
2619	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	420000	3	558600	f	2026-01-26 23:57:19.172066	f
2620	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	441000	3	586530	t	2026-01-26 23:57:19.663766	f
2621	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	463050	3	615856.5	f	2026-01-26 23:57:31.259504	f
2622	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	486203	3	646650	t	2026-01-26 23:57:31.705285	f
2623	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	510514	3	678983.6	f	2026-01-26 23:57:39.379214	f
2624	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	536040	3	712933.2	t	2026-01-26 23:57:39.846955	f
2625	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	562842	3	748579.9	f	2026-01-26 23:57:57.719931	f
2626	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	590985	3	786010.06	t	2026-01-26 23:57:58.164787	f
2627	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	620535	3	825311.56	f	2026-01-26 23:58:15.260436	f
2628	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	651562	3	866577.44	t	2026-01-26 23:58:15.707727	f
2629	4816	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	684141	3	909907.5	f	2026-01-26 23:58:21.952831	f
2630	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	718349	3	955404.2	t	2026-01-26 23:58:22.542314	f
2631	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.215507e+06	1	1.215507e+06	f	2026-01-27 00:13:36.628293	f
2632	4782	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.021026e+06	2	1.2762825e+06	t	2026-01-27 00:13:37.087219	f
2633	4782	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.5e+06	1	1.5e+06	f	2026-01-27 00:13:56.264889	f
2634	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	525000	1	525000	f	2026-01-27 00:17:44.251341	f
2635	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	441000	2	551250	t	2026-01-27 00:17:44.700218	f
2636	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	1e+06	1	1e+06	f	2026-01-27 00:17:59.645795	f
2637	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	840000	2	1.05e+06	t	2026-01-27 00:18:00.091963	f
2638	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.2e+06	1	1.2e+06	f	2026-01-27 00:18:13.89488	f
2639	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.008e+06	2	1.26e+06	t	2026-01-27 00:18:14.368884	f
2640	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.03205e+06	2	1.2900625e+06	t	2026-01-27 00:21:08.720834	f
2641	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	1.083653e+06	2	1.3545662e+06	t	2026-01-27 00:21:09.277648	f
2642	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.137836e+06	2	1.422295e+06	t	2026-01-27 00:21:45.394011	f
2643	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	1.194728e+06	2	1.49341e+06	t	2026-01-27 00:21:45.874137	f
2644	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.254465e+06	2	1.5680812e+06	t	2026-01-27 00:21:46.275253	f
2645	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	1.317189e+06	2	1.6464862e+06	t	2026-01-27 00:21:46.668816	f
2646	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.383049e+06	2	1.7288112e+06	t	2026-01-27 00:21:47.071005	f
2647	4792	cc78d40c-9179-4616-9834-9aa9c69963fa	1.452202e+06	2	1.8152525e+06	t	2026-01-27 00:21:47.477282	f
2648	4792	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1.524813e+06	2	1.9060162e+06	t	2026-01-27 00:22:41.994358	f
2649	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.511135e+06	2	1.8889188e+06	t	2026-01-27 00:24:55.690097	f
2650	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.586692e+06	2	1.983365e+06	t	2026-01-27 00:24:56.159595	f
2651	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.666027e+06	2	2.0825338e+06	t	2026-01-27 00:24:56.550859	f
2652	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.749329e+06	2	2.1866612e+06	t	2026-01-27 00:24:56.968863	f
2653	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1.836796e+06	2	2.295995e+06	t	2026-01-27 00:24:57.402579	f
2654	4788	cc78d40c-9179-4616-9834-9aa9c69963fa	1.928636e+06	2	2.410795e+06	t	2026-01-27 00:24:57.790984	f
2655	4788	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2.025068e+06	2	2.531335e+06	t	2026-01-27 00:24:58.187863	f
2656	4843	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	6.919101e+06	3	9.202404e+06	t	2026-01-27 00:25:35.477256	f
2657	4781	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.4194144e+07	1	1.4194144e+07	t	2026-01-27 01:15:27.765358	f
2658	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.1205904e+07	3	1.4903852e+07	t	2026-01-27 01:19:27.756988	f
2659	4781	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.5649045e+07	1	1.5649045e+07	t	2026-01-27 01:19:28.460835	f
2660	4781	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.3145198e+07	2	1.6431498e+07	t	2026-01-27 01:22:51.628266	f
2661	4781	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1.7253072e+07	1	1.7253072e+07	t	2026-01-27 01:22:52.053236	f
2662	4790	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.117499e+06	2	8.896874e+06	t	2026-01-27 01:23:25.846717	f
2663	4792	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2.001318e+06	1	2.001318e+06	t	2026-01-27 02:04:25.552849	f
2664	4789	cc78d40c-9179-4616-9834-9aa9c69963fa	2.30264e+06	2	2.8783e+06	t	2026-01-27 02:07:07.771341	f
2665	4802	889cd08b-6e70-4f4c-847f-363dbbe2c110	969975	1	969975	t	2026-01-27 02:20:42.71043	f
2666	4802	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	814779	2	1.01847375e+06	t	2026-01-27 02:20:43.665352	f
2667	4802	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.069398e+06	1	1.069398e+06	t	2026-01-27 02:20:44.388777	f
2668	4802	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	898295	2	1.1228688e+06	t	2026-01-27 02:20:44.793182	f
2669	4802	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.179013e+06	1	1.179013e+06	t	2026-01-27 02:22:07.14974	f
2670	4807	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	400000	1	400000	t	2026-01-27 02:57:31.517468	f
2671	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	882001	2	1.1025012e+06	t	2026-01-27 02:57:58.741743	f
2672	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	870396	3	1.1576266e+06	t	2026-01-27 02:57:59.800767	f
2673	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	972407	2	1.2155088e+06	t	2026-01-27 02:58:00.952545	f
2674	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	959613	3	1.2762852e+06	t	2026-01-27 02:58:01.974946	f
2675	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.07208e+06	2	1.3401e+06	t	2026-01-27 02:58:02.895469	f
2676	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.057974e+06	3	1.4071054e+06	t	2026-01-27 02:58:03.96701	f
2677	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.181969e+06	2	1.4774612e+06	t	2026-01-27 02:58:04.872109	f
2678	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.166417e+06	3	1.5513346e+06	t	2026-01-27 02:58:05.825431	f
2679	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.303122e+06	2	1.6289025e+06	t	2026-01-27 02:58:06.740664	f
2680	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.285976e+06	3	1.7103481e+06	t	2026-01-27 02:58:07.720047	f
2681	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.436693e+06	2	1.7958662e+06	t	2026-01-27 02:58:08.537867	f
2682	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.41779e+06	3	1.8856608e+06	t	2026-01-27 02:58:09.39075	f
2683	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.583956e+06	2	1.979945e+06	t	2026-01-27 02:58:10.220954	f
2684	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.563115e+06	3	2.078943e+06	t	2026-01-27 02:58:11.020695	f
2685	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.746313e+06	2	2.1828912e+06	t	2026-01-27 02:58:11.836224	f
2686	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.723336e+06	3	2.292037e+06	t	2026-01-27 02:58:12.650995	f
2687	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.925312e+06	2	2.40664e+06	t	2026-01-27 02:58:13.578361	f
2688	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1.899979e+06	3	2.526972e+06	t	2026-01-27 02:58:14.38298	f
2689	4836	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2.122657e+06	2	2.6533212e+06	t	2026-01-27 02:58:15.175276	f
2690	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.094728e+06	3	2.7859882e+06	t	2026-01-27 02:58:16.053092	f
2691	4823	cec18033-5816-4170-97d9-81dcd4c2670b	400000	2	500000	f	2026-01-27 11:29:25.855592	f
2692	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	525000	1	525000	t	2026-01-27 14:19:46.843369	f
2693	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.323e+06	1	1.323e+06	f	2026-01-27 15:14:49.23621	f
2694	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.11132e+06	2	1.38915e+06	t	2026-01-27 15:14:50.006317	f
2695	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	800000	2	1e+06	f	2026-01-27 15:21:47.043499	f
2696	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.05e+06	1	1.05e+06	t	2026-01-27 15:21:47.48366	f
2697	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	882000	2	1.1025e+06	f	2026-01-27 15:22:54.709864	f
2698	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.157625e+06	1	1.157625e+06	t	2026-01-27 15:22:55.203745	f
2699	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.3e+06	2	1.625e+06	f	2026-01-27 15:23:13.324005	f
2700	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.70625e+06	1	1.70625e+06	t	2026-01-27 15:23:13.778442	f
2701	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.925288e+06	1	2.925288e+06	f	2026-01-27 15:30:31.689441	f
2702	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.309438e+06	3	3.0715525e+06	t	2026-01-27 15:30:32.122076	f
2703	4827	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.52065e+06	1	2.52065e+06	f	2026-01-27 15:30:39.98366	f
2704	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.117346e+06	2	2.6466825e+06	t	2026-01-27 15:30:40.42001	f
2705	4827	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.779017e+06	1	2.779017e+06	f	2026-01-27 15:30:57.253862	f
2706	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.334375e+06	2	2.9179688e+06	t	2026-01-27 15:30:57.710354	f
2707	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	8.212028e+06	1	8.212028e+06	t	2026-01-27 16:20:11.930097	f
2708	4812	e2831203-b5bb-4911-9a98-485fe4c6e3b5	400000	2	500000	t	2026-01-27 16:21:15.964129	f
2709	4820	e08f4fb4-f7df-4224-9a81-21c0f93cf810	400000	1	400000	f	2026-01-27 16:21:56.210679	f
2710	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.003175e+06	1	1.003175e+06	t	2026-01-27 16:22:25.530929	f
2711	4827	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.063868e+06	1	3.063868e+06	t	2026-01-27 16:23:29.943681	f
2712	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.57365e+06	2	3.2170625e+06	t	2026-01-27 16:23:30.755663	f
2713	4827	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.377916e+06	1	3.377916e+06	t	2026-01-27 16:23:31.506344	f
2714	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.5686386e+07	3	2.0862894e+07	t	2026-01-27 17:54:01.828756	f
2715	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.6470706e+07	3	2.1906038e+07	t	2026-01-27 17:54:02.301307	f
2716	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.729424e+07	3	2.300134e+07	t	2026-01-27 17:54:02.716898	f
2717	4832	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1.8158952e+07	3	2.4151408e+07	t	2026-01-27 17:54:03.142438	f
2718	4832	889cd08b-6e70-4f4c-847f-363dbbe2c110	1.9066902e+07	3	2.535898e+07	t	2026-01-27 17:54:26.994574	f
2719	4814	889cd08b-6e70-4f4c-847f-363dbbe2c110	6.898104e+06	2	8.62263e+06	t	2026-01-27 17:57:25.129857	f
2720	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	9.053762e+06	1	9.053762e+06	t	2026-01-27 17:57:25.597555	f
2721	4814	889cd08b-6e70-4f4c-847f-363dbbe2c110	7.605161e+06	2	9.506451e+06	t	2026-01-27 17:57:26.024845	f
2722	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	9.981774e+06	1	9.981774e+06	t	2026-01-27 17:57:26.450753	f
2723	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	1.34704e+06	3	1.7915632e+06	f	2026-01-27 18:41:35.065943	f
2724	4835	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	1.881142e+06	1	1.881142e+06	t	2026-01-27 18:41:36.11567	f
2725	4835	c4815f14-1981-43aa-b972-5f7a43ed0f13	2e+06	2	2.5e+06	f	2026-01-27 18:45:24.865964	f
2726	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.166886e+06	2	1.4586075e+06	f	2026-01-27 20:02:38.279081	f
2727	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.225231e+06	2	1.5315388e+06	t	2026-01-27 20:02:39.899194	f
2728	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.42491e+06	3	3.2251302e+06	f	2026-01-27 20:04:11.237864	f
2729	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.546156e+06	3	3.3863875e+06	t	2026-01-27 20:04:12.660248	f
2730	4813	5d77ac22-c768-4d3b-99d8-73c250a3e859	1.20911e+06	3	1.6081162e+06	f	2026-01-27 20:04:47.895073	f
2732	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	420000	1	420000	t	2026-01-27 21:15:43.924532	f
2736	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	510514	1	510514	t	2026-01-27 21:15:52.372486	f
2737	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	536040	1	536040	t	2026-01-27 21:15:54.415085	f
2739	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	590985	1	590985	t	2026-01-27 21:15:58.370326	f
2745	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	791981	1	791981	t	2026-01-27 21:16:10.054137	f
2752	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	791981	3	1.0533348e+06	t	2026-01-27 21:19:00.403306	f
2753	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.106002e+06	1	1.106002e+06	t	2026-01-27 21:19:01.780442	f
2756	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	962659	3	1.2803365e+06	t	2026-01-27 21:19:05.664744	f
2762	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.290058e+06	3	1.7157771e+06	t	2026-01-27 21:19:36.583498	f
2731	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.350818e+06	2	1.6885225e+06	t	2026-01-27 20:04:49.079629	f
2733	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	441000	1	441000	t	2026-01-27 21:15:46.100654	f
2734	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	463050	1	463050	t	2026-01-27 21:15:48.129605	f
2735	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	486203	1	486203	t	2026-01-27 21:15:50.236575	f
2738	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	562842	1	562842	t	2026-01-27 21:15:56.389076	f
2740	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	620535	1	620535	t	2026-01-27 21:16:00.273869	f
2741	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	651562	1	651562	t	2026-01-27 21:16:02.158914	f
2742	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	684141	1	684141	t	2026-01-27 21:16:04.119053	f
2743	4833	d8be0952-18cc-4082-8a6c-5de14ea569ce	718349	1	718349	t	2026-01-27 21:16:06.214591	f
2744	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	754267	1	754267	t	2026-01-27 21:16:08.167797	f
2748	4842	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	400000	1	400000	t	2026-01-27 21:18:07.674266	f
2749	4827	f335b9c3-7d63-44f3-9540-13b1d461ca13	2.83745e+06	2	3.5468125e+06	t	2026-01-27 21:18:21.615618	f
2754	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	873160	3	1.1613028e+06	t	2026-01-27 21:19:03.088631	f
2757	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.344354e+06	1	1.344354e+06	t	2026-01-27 21:19:06.963805	f
2758	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.061333e+06	3	1.4115729e+06	t	2026-01-27 21:19:32.10449	f
2759	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.482152e+06	1	1.482152e+06	t	2026-01-27 21:19:33.317801	f
2760	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.17012e+06	3	1.5562596e+06	t	2026-01-27 21:19:34.426755	f
2764	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.422289e+06	3	1.8916444e+06	t	2026-01-27 21:19:38.601087	f
2767	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	7.880348e+06	3	1.0480863e+07	t	2026-01-27 21:57:02.214557	f
2768	4827	5d77ac22-c768-4d3b-99d8-73c250a3e859	3.12829e+06	2	3.9103625e+06	f	2026-01-28 00:23:30.474395	f
2746	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	831581	1	831581	t	2026-01-27 21:16:11.961158	f
2747	4839	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	400000	1	400000	t	2026-01-27 21:16:50.520339	f
2750	4827	e08f4fb4-f7df-4224-9a81-21c0f93cf810	3.724154e+06	1	3.724154e+06	t	2026-01-27 21:18:23.297764	f
2751	4824	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	400000	1	400000	t	2026-01-27 21:18:25.159076	f
2755	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.219368e+06	1	1.219368e+06	t	2026-01-27 21:19:04.397634	f
2761	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.634073e+06	1	1.634073e+06	t	2026-01-27 21:19:35.503221	f
2763	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.801566e+06	1	1.801566e+06	t	2026-01-27 21:19:37.589925	f
2765	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.986227e+06	1	1.986227e+06	t	2026-01-27 21:19:39.601833	f
2766	4823	c532b6f7-bdfb-4505-b43f-f653770c03af	525000	1	525000	f	2026-01-27 21:49:07.162637	f
2769	4827	e08f4fb4-f7df-4224-9a81-21c0f93cf810	4.105881e+06	1	4.105881e+06	t	2026-01-28 00:23:32.313514	f
2770	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	2.844566e+06	2	3.5557075e+06	f	2026-01-28 00:25:07.517946	f
2771	4836	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2.807138e+06	3	3.7334935e+06	t	2026-01-28 00:25:08.957807	f
2772	4836	5d77ac22-c768-4d3b-99d8-73c250a3e859	4e+06	3	5.32e+06	f	2026-01-28 00:26:03.102131	f
2773	4815	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	400000	1	400000	f	2026-01-28 00:29:32.753603	f
2774	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.1004907e+07	1	1.1004907e+07	t	2026-01-28 00:59:40.557707	f
2775	4814	d8be0952-18cc-4082-8a6c-5de14ea569ce	8.688085e+06	3	1.1555153e+07	t	2026-01-28 00:59:41.004938	f
2776	4814	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1.2132911e+07	1	1.2132911e+07	t	2026-01-28 01:00:36.073094	f
2777	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.772949e+06	1	1.772949e+06	t	2026-01-28 01:59:43.85889	f
2778	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.489278e+06	2	1.8615975e+06	t	2026-01-28 01:59:44.302724	f
2779	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1.954678e+06	1	1.954678e+06	t	2026-01-28 01:59:44.694302	f
2780	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.64193e+06	2	2.0524125e+06	t	2026-01-28 01:59:45.086443	f
2781	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.155034e+06	1	2.155034e+06	t	2026-01-28 01:59:45.477689	f
2782	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.810229e+06	2	2.2627862e+06	t	2026-01-28 01:59:45.861452	f
2783	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.375926e+06	1	2.375926e+06	t	2026-01-28 01:59:46.260387	f
2784	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	1.995778e+06	2	2.4947225e+06	t	2026-01-28 01:59:46.650639	f
2785	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.619459e+06	1	2.619459e+06	t	2026-01-28 01:59:47.049327	f
2786	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.200346e+06	2	2.7504325e+06	t	2026-01-28 01:59:47.441831	f
2787	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2.887955e+06	1	2.887955e+06	t	2026-01-28 01:59:47.830422	f
2788	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.425883e+06	2	3.0323538e+06	t	2026-01-28 01:59:48.211945	f
2789	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.183972e+06	1	3.183972e+06	t	2026-01-28 01:59:48.599993	f
2790	4813	d8be0952-18cc-4082-8a6c-5de14ea569ce	2.674537e+06	2	3.3431712e+06	t	2026-01-28 01:59:48.982128	f
2791	4813	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	3.51033e+06	1	3.51033e+06	t	2026-01-28 01:59:49.379379	f
2792	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.568074e+06	3	2.0855384e+06	t	2026-01-28 02:01:00.473266	f
2793	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.189816e+06	1	2.189816e+06	t	2026-01-28 02:01:00.919021	f
2794	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.728803e+06	3	2.299308e+06	t	2026-01-28 02:01:01.321897	f
2795	4816	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2.414274e+06	1	2.414274e+06	t	2026-01-28 02:01:01.72766	f
2796	4816	f335b9c3-7d63-44f3-9540-13b1d461ca13	1.906006e+06	3	2.534988e+06	t	2026-01-28 02:01:28.992056	f
2797	4833	f335b9c3-7d63-44f3-9540-13b1d461ca13	698529	2	873161.25	t	2026-01-28 02:04:55.265366	f
2798	4833	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	916820	1	916820	t	2026-01-28 02:04:55.699692	f
2799	4833	f335b9c3-7d63-44f3-9540-13b1d461ca13	770129	2	962661.25	t	2026-01-28 02:04:56.184758	f
2800	4823	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	551250	1	551250	f	2026-01-28 02:05:22.671844	f
\.


--
-- Data for Name: email_opt_outs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_opt_outs (id, auction_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: free_agents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.free_agents (id, name, team, auction_end_time, is_active, winner_id, winning_bid_id, created_at, minimum_bid, minimum_years, player_type, avg, hr, rbi, runs, sb, ops, wins, losses, era, whip, strikeouts, ip, pa, auction_id, auction_start_time, result_emailed_at) FROM stdin;
4424	Lou Trivino	3TM	2026-01-16 02:20:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	435	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4451	DJ LeMahieu	NYY	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	142	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
1472	Gary Sanchez	BAL	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	91	4	\N	2026-01-15 05:31:12.925
4453	Connor Brogdon	LAA	2026-01-17 02:20:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	505	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4458	Kenley Jansen	LAA	2026-01-17 02:20:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	495	2026-01-11 23:29:34.496295	4.747111e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	59	0	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4467	Oswald Peraza	2TM	2026-01-17 02:30:00	f	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	663	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	265	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4438	Logan Porter	SFG	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4444	Scott Kingery	LAA	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	29	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4459	Austin Barnes	LAD	2026-01-17 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	44	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4462	Javier Assad	CHC	2026-01-17 02:30:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	676	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4457	Daz Cameron	MIL	2026-01-17 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	42	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4465	Luis Guillorme	HOU	2026-01-17 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4439	Alek Jacob	SDP	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	33	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4440	Matt Bowman	BAL	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4441	Jared Shuster	CHW	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4442	Hunter Strickland	LAA	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4443	Jaden Hill	COL	2026-01-17 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4445	Cam Booser	CHW	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4446	Caesar Prieto	STL	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4448	Julian Fernandez	2TM	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4449	Anthony Molina	COL	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4450	Randy Dobnak	MIN	2026-01-17 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4454	Scott McGough	2TM	2026-01-17 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4460	Angel Perdomo	ATH	2026-01-17 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4463	Cam Sanders	PIT	2026-01-17 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4464	Danny Young	NYM	2026-01-17 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4489	Emmanuel Rivera	BAL	2026-01-18 02:20:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	835	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	127	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4517	Seth Brown	ATH	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	76	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4521	Jason Heyward	SDP	2026-01-19 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	95	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4508	Vinny Capra	2TM	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	105	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4510	Luke Maile	KCR	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	54	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4523	Ryan Borucki	2TM	2026-01-19 02:20:00	f	4f229366-dbe3-4361-84cb-115cab42685f	877	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4527	Travis Jankowski	3TM	2026-01-19 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	50	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4518	Jared Young	NYM	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	47	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4519	Jacob Hurtubise	CIN	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	15	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4515	Brewer Hicklen	DET	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	4	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4503	Liam Hendriks	BOS	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4504	Robinson Pina	2TM	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4506	Carl Edwards Jr.	2TM	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4511	Dauri Moreta	PIT	2026-01-19 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4512	Daniel Robert	PHI	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4514	Bryan Hoeing	SDP	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4524	Ian Gibaut	CIN	2026-01-19 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4525	J.D. Davis	LAA	2026-01-19 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4847	Carlos Santana	\N	2026-01-19 21:00:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	1250	2026-01-17 06:25:10.959736	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	2026-01-19 21:04:21.296
4545	Zach Thompson	ATL	2026-01-20 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4598	Joc Pederson	TEX	2026-01-21 02:30:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1451	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	306	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4601	Luke Raley	SEA	2026-01-21 02:30:00	f	51f792dc-04f3-467f-a604-631165c75b38	1473	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	219	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4604	Hyeseong Kim	LAD	2026-01-21 02:30:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	1440	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	170	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4600	Ryan Pressly	CHC	2026-01-21 02:30:00	f	51f792dc-04f3-467f-a604-631165c75b38	1386	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	41	0	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4571	Tyler Zuber	2TM	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4572	Jordyn Adams	BAL	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	5	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4573	Bruce Zimmermann	MIL	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4748	Travis d'Arnaud	LAA	2026-01-26 02:00:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2476	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	231	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4746	Jacob Stallings	2TM	2026-01-26 02:00:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	2461	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	129	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4756	Michael Lorenzen	KCR	2026-01-26 02:10:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2495	2026-01-11 23:29:34.496295	3.262117e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	141	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4429	Ryan Gusto	2TM	2026-01-16 02:30:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	443	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	101	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4492	Jose Fermin	LAA	2026-01-18 02:20:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	413	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4490	Enmanuel Valdez	PIT	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	102	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4493	Jesse Winker	NYM	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	81	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4491	Ji Hwan Bae	PIT	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	25	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4482	Sean Guenther	DET	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4483	Jonathan Loaisiga	NYY	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4485	Collin Snider	SEA	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4486	Jon Gray	TEX	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4487	John Curtiss	ARI	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4488	Luarbert Arias	MIA	2026-01-18 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-15 14:20:00	2026-01-18 02:28:45.817
4549	Nolan Arenado	STL	2026-01-20 02:10:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	1050	2026-01-11 23:29:34.496295	3.518755e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	436	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4563	Daniel Lynch IV	KCR	2026-01-20 02:20:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	1292	2026-01-11 23:29:34.496295	739000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4570	Mike Trout	LAA	2026-01-20 02:30:00	f	388f55c3-52e1-499f-8a56-948636a8c205	1172	2026-01-11 23:29:34.496295	3.186207e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	556	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4568	Ildemaro Vargas	ARI	2026-01-20 02:30:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	1276	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	121	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4553	Donovan Walton	PHI	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4554	Manuel Margot	DET	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4561	Vimael Machin	BAL	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	12	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4547	Sammy Peralta	LAA	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4548	Elvin Rodriguez	2TM	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4550	Eduarniel Nunez	2TM	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4551	Craig Kimbrel	2TM	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4552	Miguel Castro	CHW	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4556	Jake Woodford	ARI	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4557	Cody Bolton	CLE	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4559	Eduardo Salazar	WSN	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4560	Jesse Scholtens	TBR	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4562	Kevin Pillar	TEX	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	43	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4564	Logan Gillaspie	SDP	2026-01-20 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4565	Drey Jameson	ARI	2026-01-20 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4566	Kendall Graveman	ARI	2026-01-20 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4567	Matt Sauer	LAD	2026-01-20 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4569	Lucas Gilbreath	COL	2026-01-20 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-17 14:30:00	2026-01-20 03:03:48.096
4574	Spencer Turnbull	TOR	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4575	Corbin Martin	BAL	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4576	Blake Treinen	LAD	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4580	Alex Lange	DET	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4588	Ezequiel Duran	TEX	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4589	Ali Sanchez	2TM	2026-01-21 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	23	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4591	Seth Martinez	MIA	2026-01-21 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4595	Chris Roycroft	STL	2026-01-21 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4602	Sergio Alcantara	SFG	2026-01-21 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	4	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4605	Jesse Hahn	SEA	2026-01-21 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4757	Jordan Hicks	2TM	2026-01-26 02:10:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2484	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4743	Justin Dean	LAD	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4744	Marc Church	TEX	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4745	T.J. McFarland	ATH	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4747	Kevin Herget	2TM	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4750	Beau Brieske	DET	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4751	Yaramil Hiraldo	BAL	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4752	A.J. Minter	NYM	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4753	Keaton Winn	SFG	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4754	Anthony Misiewicz	MIN	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4755	Victor Mederos	LAA	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4758	Sam Moll	CIN	2026-01-26 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	10	2026-01-23 14:10:00	2026-01-26 02:14:55.075
4425	Charlie Morton	3TM	2026-01-16 02:20:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	411	2026-01-11 23:29:34.496295	544612	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	142	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4427	Cedric Mullins	2TM	2026-01-16 02:30:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	480	2026-01-11 23:29:34.496295	2.697591e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	498	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4428	Juan Morillo	ARI	2026-01-16 02:30:00	f	4f229366-dbe3-4361-84cb-115cab42685f	437	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4364	Randal Grichuk	2TM	2026-01-15 02:00:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	377	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	293	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4426	Yuli Gurriel	SDP	2026-01-16 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	40	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4423	Owen Miller	COL	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	17	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4433	Cesar Salazar	HOU	2026-01-16 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	16	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4417	Nick Ahmed	TEX	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4431	Justin Topa	MIN	2026-01-16 02:30:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	444	2026-01-11 23:29:34.496295	759229	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	60	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4419	Albert Suarez	BAL	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4420	Tayler Scott	2TM	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	27	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4421	Randy Wynne	CIN	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4422	Elvis Peguero	2TM	2026-01-16 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4430	Adam Ottavino	NYY	2026-01-16 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4432	Mark Leiter Jr.	NYY	2026-01-16 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	403608	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4434	Shawn Dubin	2TM	2026-01-16 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	33	0	10	2026-01-13 14:30:00	2026-01-16 02:35:14.308
4501	Brandon Waddell	NYM	2026-01-18 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4502	Jesse Chavez	ATL	2026-01-18 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4624	Jose Altuve	HOU	2026-01-22 02:20:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1585	2026-01-11 23:29:34.496295	5.69622e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	654	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4651	Jayvien Sandridge	NYY	2026-01-23 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4652	Freddy Tarnok	MIA	2026-01-23 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4655	Greg Allen	BAL	2026-01-23 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	14	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4658	Jesus Tinoco	MIA	2026-01-23 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4662	Mike Clevinger	CHW	2026-01-23 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4665	Gerson Garabito	TEX	2026-01-23 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4667	Xzavion Curry	MIA	2026-01-23 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4668	Mason Thompson	WSN	2026-01-23 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4669	Michael Tonkin	MIN	2026-01-23 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	0	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4673	Nate Pearson	CHC	2026-01-23 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4688	Yohel Pozo	STL	2026-01-24 02:10:00	f	0477609b-080d-4cd2-b891-117e615bdf47	1966	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	168	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4717	Luis Felipe Castillo	SEA	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4720	Ty Adcock	NYM	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4721	J.P. Feyereisen	2TM	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4722	Jeff Brigham	ARI	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4723	Jacob Barnes	TOR	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4725	Ethan Roberts	CHC	2026-01-25 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4726	George Soriano	MIA	2026-01-25 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4728	Tayler Saucedo	SEA	2026-01-25 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4730	Nick Hernandez	HOU	2026-01-25 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4764	Aramis Garcia	ARI	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	4	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4765	Nick Paul Anderson	COL	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4766	Ian Anderson	LAA	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4768	Terrin Vavra	BAL	2026-01-26 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4773	Anthony Maldonado	ATH	2026-01-26 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4775	Jose Ruiz	2TM	2026-01-26 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4848	Jose Urquidy	DET	2026-01-26 23:00:00	t	\N	\N	2026-01-25 14:27:58.753087	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	2026-01-27 00:01:06.707
4807	Weston Wilson	PHI	2026-01-28 02:00:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2670	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	125	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4812	Andrew Knizner	SFG	2026-01-28 02:00:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2708	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	88	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4823	Justin Lawrence	PIT	2026-01-28 02:10:00	f	c532b6f7-bdfb-4505-b43f-f653770c03af	2803	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4824	Konnor Pilkington	WSN	2026-01-28 02:10:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2751	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	28	0	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4813	Austin Gomber	COL	2026-01-28 02:00:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2791	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	57	0	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4817	Sam Hilliard	COL	2026-01-28 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	61	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4814	Willi Castro	2TM	2026-01-28 02:00:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2776	2026-01-11 23:29:34.496295	1.500055e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	454	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4810	Leo Jimenez	TOR	2026-01-28 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	32	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4830	Luis Vazquez	BAL	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4809	Greg Jones	CHW	2026-01-28 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4612	Antonio Senzatela	COL	2026-01-22 02:00:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	1611	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	130	0	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4621	Andres Gimenez	TOR	2026-01-22 02:10:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	1492	2026-01-11 23:29:34.496295	5.449527e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	369	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4633	Abraham Toro	BOS	2026-01-22 02:30:00	f	51f792dc-04f3-467f-a604-631165c75b38	1626	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	284	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4616	Masataka Yoshida	BOS	2026-01-22 02:10:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1627	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	205	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4617	J.C. Escarra	NYY	2026-01-22 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	98	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4637	Nick Maton	CHW	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	63	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4627	Daniel Johnson	2TM	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	57	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4619	Bryan De La Cruz	ATL	2026-01-22 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	50	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4620	Dairon Blanco	KCR	2026-01-22 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4622	Drew Avans	2TM	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
1686	Jose Miranda	MIN	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	36	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
4628	David Banuelos	BAL	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4631	Akil Baddoo	DET	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4634	Chadwick Tromp	2TM	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	22	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4615	CJ Alexander	ATH	2026-01-22 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	17	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4618	John Brebbia	2TM	2026-01-22 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	0	10	2026-01-19 14:10:00	2026-01-22 02:57:08.956
4623	Nick Burdi	BOS	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4625	Shaun Anderson	LAA	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4626	Kyle Gibson	BAL	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4629	Scott Blewett	3TM	2026-01-22 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	0	10	2026-01-19 14:20:00	2026-01-22 02:57:08.956
4630	David Robertson	PHI	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4632	Carson Spiers	CIN	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4635	Joey Gerber	TBR	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4636	Tanner Rainey	2TM	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4638	Isaiah Campbell	BOS	2026-01-22 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-19 14:30:00	2026-01-22 02:57:08.956
4696	Joey Wiemer	MIA	2026-01-24 02:20:00	f	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1967	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	61	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4792	Shelby Miller	2TM	2026-01-27 02:20:00	f	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2663	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	46	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4785	MJ Melendez	KCR	2026-01-27 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	65	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4793	Hoby Milner	TEX	2026-01-27 02:20:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	2582	2026-01-11 23:29:34.496295	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	70	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4786	Brian Navarreto	MIA	2026-01-27 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	15	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4794	Gregory Santos	SEA	2026-01-27 02:20:00	f	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	2610	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4802	Ronel Blanco	HOU	2026-01-27 02:30:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	2669	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4777	Geoff Hartlieb	2TM	2026-01-27 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4778	Erik Swanson	TOR	2026-01-27 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4780	Sandy Leon	ATL	2026-01-27 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	12	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4783	Garrett Stubbs	PHI	2026-01-27 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4787	Penn Murfee	CHW	2026-01-27 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4791	John Rooney	HOU	2026-01-27 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4795	Jose Quijada	LAA	2026-01-27 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4796	Robert Stock	BOS	2026-01-27 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4797	Luis Contreras	HOU	2026-01-27 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4798	Coco Montes	TBR	2026-01-27 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4799	Austin Warren	NYM	2026-01-27 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-24 14:20:00	2026-01-27 03:01:31.528
4800	Zach Pop	2TM	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4801	Kaleb Ort	HOU	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	46	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4803	Tommy Henry	ARI	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4804	Rich Hill	KCR	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4805	Kenta Maeda	DET	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4811	Ryan Burr	TOR	2026-01-28 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4815	Omar Narvaez	CHW	2026-01-28 02:00:00	f	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2773	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4818	Bryan Hudson	2TM	2026-01-28 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4819	Casey Lawrence	2TM	2026-01-28 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4821	Jovani Moran	BOS	2026-01-28 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4820	Jonah Bride	2TM	2026-01-28 02:10:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2709	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	125	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4816	Jeremiah Jackson	BAL	2026-01-28 02:10:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2804	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	183	10	2026-01-25 14:10:00	2026-01-28 02:22:46.111
4825	Wander Suero	ATL	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4826	Joe La Sorsa	CIN	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4705	Yu Darvish	SDP	2026-01-24 02:30:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2082	2026-01-11 23:29:34.496295	713152	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	72	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4828	Trevor Richards	2TM	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4829	Easton McGee	MIL	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4831	Austin Cox	ATL	2026-01-28 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4367	Chuckie Robinson	LAD	2026-01-15 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4833	Genesis Cabrera	4TM	2026-01-28 02:20:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	2799	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4685	Andrew Heaney	2TM	2026-01-24 02:10:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	2083	2026-01-11 23:29:34.496295	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	122	0	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4690	Tommy Nance	TOR	2026-01-24 02:10:00	f	7779ed21-af49-4fbd-8127-c5a869384569	2084	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4695	Ryan Noda	2TM	2026-01-24 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	59	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
1835	Jacob Barnes	TOR	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
4691	Kyle Hendricks	LAA	2026-01-24 02:20:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2024	2026-01-11 23:29:34.496295	2.659937e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	164	0	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4692	Zach Dezenzo	HOU	2026-01-24 02:20:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	2062	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	109	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4679	Eric Haase	MIL	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	77	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4694	Tanner Gordon	COL	2026-01-24 02:20:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2064	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	75	0	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4684	Tirso Ornelas	SDP	2026-01-24 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	16	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4682	Samad Taylor	SEA	2026-01-24 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4677	Dom Nunez	CLE	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4678	Nick Solak	PIT	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	11	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4701	Rob Zastryzny	MIL	2026-01-24 02:30:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	1959	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4681	Cody Poteet	BAL	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4683	Chris Devenski	NYM	2026-01-24 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4687	Omar Cruz	SDP	2026-01-24 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4689	Josh Walker	TOR	2026-01-24 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4693	Ben Bowden	ATH	2026-01-24 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4697	Codi Heuer	2TM	2026-01-24 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4698	Brett de Geus	PHI	2026-01-24 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-21 14:20:00	2026-01-24 02:54:11.613
4700	Tom Cosgrove	CHC	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4702	Reiver Sanmartin	CIN	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4703	Chad Wallach	LAA	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4704	Carlos Rodriguez	MIL	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4706	Erasmo Ramirez	MIN	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4827	Johan Rojas	PHI	2026-01-28 02:20:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2769	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	172	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4369	Jon Singleton	HOU	2026-01-15 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
1461	Chuckie Robinson	LAD	2025-12-28 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	4	\N	2026-01-15 05:31:12.925
4370	Seth Lugo	KCR	2026-01-15 02:00:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	233	2026-01-11 23:29:34.496295	1.2913587e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	145	0	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4401	James McCann	ARI	2026-01-16 02:00:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	471	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	137	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4402	Carlos Cortes	ATH	2026-01-16 02:00:00	f	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	410	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	99	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4412	Max Steven Muncy	LAD	2026-01-16 02:10:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	476	2026-01-11 23:29:34.496295	4.38391e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	388	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4410	Lane Thomas	CLE	2026-01-16 02:10:00	f	0477609b-080d-4cd2-b891-117e615bdf47	457	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	142	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4408	Amed Rosario	2TM	2026-01-16 02:10:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	479	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	191	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4407	Oliver Dunn	MIL	2026-01-16 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	41	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4404	Nicky Lopez	2TM	2026-01-16 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	28	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4415	Jose Azacar	2TM	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4406	Steward Berroa	MIL	2026-01-16 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4403	Scott Effross	NYY	2026-01-16 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4405	Colin Holderman	PIT	2026-01-16 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4409	Owen White	CHW	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4411	Wade Miley	CIN	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4413	Tony Gonsolin	LAD	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4414	Michael Fulmer	2TM	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
4416	Jordan Weems	HOU	2026-01-16 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-13 14:10:00	2026-01-16 02:35:14.308
1780	Brett Harris	ATH	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	73	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
4475	Andrew McCutchen	PIT	2026-01-18 02:00:00	f	51f792dc-04f3-467f-a604-631165c75b38	852	2026-01-11 23:29:34.496295	586191	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	551	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4477	Max Kranick	NYM	2026-01-18 02:10:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	861	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4473	Mark Canha	KCR	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	125	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4468	Sean Bouchard	COL	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	73	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4472	Brett Sullivan	PIT	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4469	Luis Garcia	HOU	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4470	Dillon Tate	TOR	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4471	Evan Sisk	2TM	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4474	Michael Petersen	2TM	2026-01-18 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	10	2026-01-15 14:00:00	2026-01-18 02:28:45.817
4476	Michel Otanez	ATH	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4478	Julian Merryweather	CHC	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4479	Justin Bruihl	TOR	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4480	Kyle Nelson	ARI	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4481	Zack Kelly	BOS	2026-01-18 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4435	Endy Rodriguez	PIT	2026-01-17 02:00:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	543	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	57	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4436	Max Scherzer	TOR	2026-01-17 02:00:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	648	2026-01-11 23:29:34.496295	678240	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	85	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4447	Marcell Ozuna	ATL	2026-01-17 02:10:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	665	2026-01-11 23:29:34.496295	5.529954e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	592	10	2026-01-14 14:10:00	2026-01-17 02:34:37.439
4455	Alex Verdugo	ATL	2026-01-17 02:20:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	664	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	213	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
4418	Rico Garcia	3TM	2026-01-16 02:20:00	f	4f229366-dbe3-4361-84cb-115cab42685f	438	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-13 14:20:00	2026-01-16 02:35:14.308
4546	Luken Baker	STL	2026-01-20 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	41	10	2026-01-17 14:10:00	2026-01-20 03:03:48.096
4536	Tyler Anderson	LAA	2026-01-19 02:30:00	f	51f792dc-04f3-467f-a604-631165c75b38	1133	2026-01-11 23:29:34.496295	4.916636e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	136	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4484	Tanner Scott	LAD	2026-01-18 02:10:00	f	5084741d-1673-42b3-a8e3-3d422874e814	848	2026-01-11 23:29:34.496295	2.952433e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	57	0	10	2026-01-15 14:10:00	2026-01-18 02:28:45.817
4528	Joel Payamps	2TM	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4529	Anthony Veneziano	2TM	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4530	Scott Alexander	2TM	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4531	Carlos Hernandez	3TM	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4532	Joel Peguero	SFG	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4533	Joe Mantiply	ARI	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4534	Colin Selby	BAL	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4535	Dane Dunning	2TM	2026-01-19 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	0	10	2026-01-16 14:30:00	2026-01-19 03:29:17.593
4494	Rafael Montero	3TM	2026-01-18 02:30:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	770	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	60	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4496	Frankie Montas	NYM	2026-01-18 02:30:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	472	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4497	Eric Lauer	TOR	2026-01-18 02:30:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	863	2026-01-11 23:29:34.496295	1.848417e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	104	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4499	Grant Holmes	ATL	2026-01-18 02:30:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	841	2026-01-11 23:29:34.496295	2.161e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	115	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4500	Nick Martinez	CIN	2026-01-18 02:30:00	f	51f792dc-04f3-467f-a604-631165c75b38	849	2026-01-11 23:29:34.496295	1.3928991e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	165	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4495	Allan Winans	NYY	2026-01-18 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4498	Forrest Whitley	2TM	2026-01-18 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-15 14:30:00	2026-01-18 03:29:05.053
4507	Bryan Baker	2TM	2026-01-19 02:00:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1057	2026-01-11 23:29:34.496295	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4509	Ryan Helsley	2TM	2026-01-19 02:00:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	1071	2026-01-11 23:29:34.496295	3.307603e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	56	0	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4522	Matt Gage	2TM	2026-01-19 02:20:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	873	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4513	Reynaldo Lopez	ATL	2026-01-19 02:10:00	f	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	1059	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4526	Gio Urshela	ATH	2026-01-19 02:20:00	f	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	497	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	197	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4539	Jason Alexander	2TM	2026-01-20 02:00:00	f	5084741d-1673-42b3-a8e3-3d422874e814	1291	2026-01-11 23:29:34.496295	412000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	77	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4540	Ian Hamilton	NYY	2026-01-20 02:00:00	f	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	1053	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	40	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4541	Martin Perez	CHW	2026-01-20 02:00:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1285	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	56	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4544	Daysbel Hernandez	ATL	2026-01-20 02:00:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	1211	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4538	Corey Julks	CHW	2026-01-20 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	13	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4537	Chris Stratton	2TM	2026-01-20 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4542	Grant Holman	ATH	2026-01-20 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	0	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4543	Carter Kieboom	LAA	2026-01-20 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	10	2026-01-17 14:00:00	2026-01-20 02:03:07.926
4606	Zack Short	HOU	2026-01-22 02:00:00	f	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	1587	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	56	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4611	Miles Mikolas	STL	2026-01-22 02:00:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	1624	2026-01-11 23:29:34.496295	700000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	156	0	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4577	Aaron Nola	PHI	2026-01-21 02:00:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1045	2026-01-11 23:29:34.496295	6.284332e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	94	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4579	Chris Flexen	CHC	2026-01-21 02:00:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	1166	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4586	Rowdy Tellez	2TM	2026-01-21 02:10:00	f	51f792dc-04f3-467f-a604-631165c75b38	1365	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	312	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4587	Raisel Iglesias	ATL	2026-01-21 02:10:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	886	2026-01-11 23:29:34.496295	5.371276e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4555	Luke Williams	ATL	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	34	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4578	Gustavo Campero	LAA	2026-01-21 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	66	10	2026-01-18 14:00:00	2026-01-21 02:56:52.039
4592	Tommy Pham	PIT	2026-01-21 02:20:00	f	d8be0952-18cc-4082-8a6c-5de14ea569ce	1375	2026-01-11 23:29:34.496295	606000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	449	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4610	Aaron Schunk	COL	2026-01-22 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	33	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4607	Nick Raquet	STL	2026-01-22 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4608	Luis Peralta	COL	2026-01-22 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4609	Matt Waldron	SDP	2026-01-22 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4599	Mason McCoy	SDP	2026-01-21 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	26	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4590	Roki Sasaki	LAD	2026-01-21 02:20:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	1399	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4582	Trenton Brooks	SDP	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	43	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4593	Kodai Senga	NYM	2026-01-21 02:20:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	1316	2026-01-11 23:29:34.496295	5.58954e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	113	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4596	Patrick Corbin	TEX	2026-01-21 02:20:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	1464	2026-01-11 23:29:34.496295	698240	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	155	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4597	Nic Enright	CLE	2026-01-21 02:20:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	1293	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	10	2026-01-18 14:20:00	2026-01-21 02:56:52.039
4581	Jonathan Ornelas	2TM	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4584	Sebastian Rivero	LAA	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	34	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4603	Ryan McMahon	2TM	2026-01-21 02:30:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	1475	2026-01-11 23:29:34.496295	5.318518e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	586	10	2026-01-18 14:30:00	2026-01-21 02:56:52.039
4676	Trent Thornton	SEA	2026-01-24 02:00:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1819	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4674	Jose Siri	NYM	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	36	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4647	Connor Wong	BOS	2026-01-23 02:00:00	f	51f792dc-04f3-467f-a604-631165c75b38	1784	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	188	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4641	Luis Vazquez	BAL	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4614	Adam Frazier	2TM	2026-01-22 02:00:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	1589	2026-01-11 23:29:34.496295	888523	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	459	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4675	Hector Neris	3TM	2026-01-24 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4642	Donovan Solano	2TM	2026-01-23 02:00:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	1710	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	179	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4661	Orlando Arcia	2TM	2026-01-23 02:20:00	f	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1870	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	214	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4660	Jacob deGrom	TEX	2026-01-23 02:20:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	1906	2026-01-11 23:29:34.496295	9.764327e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	172	0	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4639	John Schreiber	KCR	2026-01-23 02:00:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	1734	2026-01-11 23:29:34.496295	740000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	64	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4671	Jose Iglesias	SDP	2026-01-23 02:30:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1851	2026-01-11 23:29:34.496295	701000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	343	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4644	Connor Kaiser	ARI	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	19	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4666	Joe Ross	PHI	2026-01-23 02:30:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	1915	2026-01-11 23:29:34.496295	408800	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	51	0	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4640	Justin Garza	NYM	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4643	Brooks Kriske	2TM	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4645	Tim Mayza	2TM	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4657	Stuart Fairchild	ATL	2026-01-23 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	55	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4656	Justin Turner	CHC	2026-01-23 02:10:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	1586	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	191	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4670	Alan Trejo	COL	2026-01-23 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	43	10	2026-01-20 14:30:00	2026-01-23 03:05:34.327
4648	Cole Sulser	TBR	2026-01-23 02:10:00	f	c532b6f7-bdfb-4505-b43f-f653770c03af	1873	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4654	Tucker Barnhart	TEX	2026-01-23 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	15	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4649	Nabil Crismatt	ARI	2026-01-23 02:10:00	f	f335b9c3-7d63-44f3-9540-13b1d461ca13	1708	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4653	Ryan Rolison	COL	2026-01-23 02:10:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	1848	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4664	Elias Diiaz	SDP	2026-01-23 02:20:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	1869	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	283	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4663	Joshua Palacios	CHW	2026-01-23 02:20:00	f	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	1854	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	145	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4650	Thomas Hatch	2TM	2026-01-23 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	10	2026-01-20 14:10:00	2026-01-23 03:05:34.327
4741	Cooper Hummel	2TM	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	105	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4738	Marcus Stroman	NYY	2026-01-25 02:30:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	2163	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	39	0	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4740	Huascar Brazoban	NYM	2026-01-25 02:30:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	2137	2026-01-11 23:29:34.496295	700000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	63	0	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4734	Connor Joe	2TM	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	80	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4733	Brett Wisely	2TM	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	63	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4739	Keston Hiura	COL	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4737	Billy McKinney	TEX	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4732	Jorge Alfaro	WSN	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	39	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4735	Eddie Rosario	2TM	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4736	Tyler Matzek	NYY	2026-01-25 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-22 14:30:00	2026-01-25 03:27:26.865
4712	Jack Suwinski	PIT	2026-01-25 02:00:00	f	4f229366-dbe3-4361-84cb-115cab42685f	2116	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	178	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4710	Chris Taylor	2TM	2026-01-25 02:00:00	f	e08f4fb4-f7df-4224-9a81-21c0f93cf810	2108	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	125	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4715	Andres Chaparro	WSN	2026-01-25 02:00:00	f	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	1684	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	73	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4719	Andres Munoz	SEA	2026-01-25 02:10:00	f	02538c92-2a46-43e6-8351-33297d6de099	2142	2026-01-11 23:29:34.496295	7.610239e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	62	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4731	Matt Olson	ATL	2026-01-25 02:20:00	f	4f229366-dbe3-4361-84cb-115cab42685f	2028	2026-01-11 23:29:34.496295	2.203689e+07	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	724	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4718	Nate Eaton	BOS	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	90	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4724	Jurickson Profar	ATL	2026-01-25 02:20:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	2162	2026-01-11 23:29:34.496295	3.322322e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	371	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4729	Drew Rasmussen	TBR	2026-01-25 02:20:00	f	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	2159	2026-01-11 23:29:34.496295	1.3311673e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	150	0	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4680	Bryse Wilson	CHW	2026-01-24 02:00:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	2073	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	10	2026-01-21 14:00:00	2026-01-24 02:54:11.613
4711	Bobby Dalbec	CHW	2026-01-25 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4727	Buddy Kennedy	3TM	2026-01-25 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	32	10	2026-01-22 14:20:00	2026-01-25 02:27:20.948
4707	Jose Barrero	STL	2026-01-25 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	31	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4708	Lucas Sims	WSN	2026-01-25 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4713	Richard Lovelady	2TM	2026-01-25 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4714	Will Banfield	CIN	2026-01-25 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4716	Nick Sandlin	TOR	2026-01-25 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	10	2026-01-22 14:10:00	2026-01-25 02:27:20.948
4742	Jose Espada	BAL	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
4759	Juan Mejia	COL	2026-01-26 02:20:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	2488	2026-01-11 23:29:34.496295	598124	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	61	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4770	Taylor Rogers	2TM	2026-01-26 02:30:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	2513	2026-01-11 23:29:34.496295	600000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	50	0	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4772	Jonathan Bowlan	KCR	2026-01-26 02:30:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2522	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	0	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4774	Trevor Williams	WSN	2026-01-26 02:30:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2520	2026-01-11 23:29:34.496295	757375	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	82	0	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4769	Nick Martini	COL	2026-01-26 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	111	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4762	Jarred Kelenic	ATL	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	65	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4771	Michael Stefanic	TOR	2026-01-26 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	25	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4760	Gavin Hollowell	CHC	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4761	Seth Johnson	PHI	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4763	Matt Krook	ATH	2026-01-26 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-23 14:20:00	2026-01-26 03:15:41.375
4782	Kike Hernandez	LAD	2026-01-27 02:00:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	2633	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	256	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4781	Bailey Ober	MIN	2026-01-27 02:00:00	f	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2661	2026-01-11 23:29:34.496295	8.362016e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	146	0	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4784	Kyle Hart	SDP	2026-01-27 02:10:00	f	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	2596	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4789	Andrew Kittredge	2TM	2026-01-27 02:10:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	2664	2026-01-11 23:29:34.496295	1.558514e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	53	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4790	Jameson Taillon	CHC	2026-01-27 02:10:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	2662	2026-01-11 23:29:34.496295	5.430954e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	129	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
4779	Jhonny Pereda	2TM	2026-01-27 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	78	10	2026-01-24 14:00:00	2026-01-27 03:01:31.528
4806	Tim Anderson	LAA	2026-01-27 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	90	10	2026-01-24 14:30:00	2026-01-27 03:01:31.528
4558	Jhonathan Diaz	SEA	2026-01-20 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	10	2026-01-17 14:20:00	2026-01-20 03:03:48.096
4437	Kevin Gausman	TOR	2026-01-17 02:00:00	f	889cd08b-6e70-4f4c-847f-363dbbe2c110	516	2026-01-11 23:29:34.496295	1.6520056e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	193	0	10	2026-01-14 14:00:00	2026-01-17 02:34:37.439
4399	Carlos Rodon	NYY	2026-01-16 02:00:00	f	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	124	2026-01-11 23:29:34.496295	2.4e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	195	0	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4400	Emilio Pagan	CIN	2026-01-16 02:00:00	f	388f55c3-52e1-499f-8a56-948636a8c205	236	2026-01-11 23:29:34.496295	3.982089e+06	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	10	2026-01-13 14:00:00	2026-01-16 02:35:14.308
4461	Tomos Nido	DET	2026-01-17 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	37	10	2026-01-14 14:30:00	2026-01-17 02:34:37.439
4456	Billy Cook	PIT	2026-01-17 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	10	2026-01-14 14:20:00	2026-01-17 02:34:37.439
1462	Oscar Gonzalez	SDP	2025-12-28 01:00:00	f	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	58	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	59	4	\N	2026-01-15 05:31:12.925
4832	Willy Adames	SFG	2026-01-28 02:20:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2807	2026-01-11 23:29:34.496295	3.214915e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	686	10	2026-01-25 14:20:00	2026-01-28 02:22:46.111
4843	Christian Walker	HOU	2026-01-28 02:30:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	2656	2026-01-11 23:29:34.496295	6.919101e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	640	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4835	Hunter Feduccia	2TM	2026-01-28 02:30:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	2725	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	105	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4836	Matt Vierling	DET	2026-01-28 02:30:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	2772	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	100	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4839	Anthony DeSclafani	ARI	2026-01-28 02:30:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2747	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4844	Gerrit Cole	NYY	2026-01-17 23:00:00	f	51f792dc-04f3-467f-a604-631165c75b38	833	2026-01-12 19:56:14.750464	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	2026-01-17 23:29:04.852
4613	Tyler Black	MIL	2026-01-22 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	13	10	2026-01-19 14:00:00	2026-01-22 02:57:08.956
4505	Taylor Trammell	HOU	2026-01-19 02:00:00	f	d8be0952-18cc-4082-8a6c-5de14ea569ce	1123	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	135	10	2026-01-16 14:00:00	2026-01-19 02:29:01.693
4516	Esteury Ruiz	LAD	2026-01-19 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	23	10	2026-01-16 14:10:00	2026-01-19 02:29:01.693
4520	Justin Verlander	SFG	2026-01-19 02:20:00	f	5d77ac22-c768-4d3b-99d8-73c250a3e859	1132	2026-01-11 23:29:34.496295	5.229984e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	152	0	10	2026-01-16 14:20:00	2026-01-19 02:29:01.693
4585	DaShawn Keirsey Jr.	MIN	2026-01-21 02:10:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	887	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	88	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4842	Carson Fulmer	LAA	2026-01-28 02:30:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	2748	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4840	Ryan Kreidler	DET	2026-01-28 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	44	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4837	David Villar	SFG	2026-01-28 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	25	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4834	Niko Kavadas	LAA	2026-01-28 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	23	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4838	Dedniel Nunez	NYM	2026-01-28 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4841	Cionel Perez	BAL	2026-01-28 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	10	2026-01-25 14:30:00	2026-01-28 03:23:00.992
4808	Alan Rangel	PHI	2026-01-28 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-25 14:00:00	2026-01-28 02:22:46.111
4583	Jose Miranda	MIN	2026-01-21 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	36	10	2026-01-18 14:10:00	2026-01-21 02:56:52.039
4767	Teoscar Hernandez	LAD	2026-01-26 02:30:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	2526	2026-01-11 23:29:34.496295	3.960304e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	546	10	2026-01-23 14:30:00	2026-01-26 03:15:41.375
4659	Freddie Freeman	LAD	2026-01-23 02:20:00	f	02538c92-2a46-43e6-8351-33297d6de099	1905	2026-01-11 23:29:34.496295	1.68041e+07	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	627	10	2026-01-20 14:20:00	2026-01-23 03:05:34.327
4699	Johnathan Rodriguez	CLE	2026-01-24 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	77	10	2026-01-21 14:30:00	2026-01-24 02:54:11.613
4686	Jorge Barrosa	ARI	2026-01-24 02:10:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	1759	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	77	10	2026-01-21 14:10:00	2026-01-24 02:54:11.613
4845	Bryce Jarvis	ARI	2026-01-16 23:00:00	t	\N	\N	2026-01-14 01:26:42.57968	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	2026-01-16 23:34:35.038
4846	Blake Dunn	CIN	2026-01-16 23:00:00	t	\N	\N	2026-01-14 01:27:27.21061	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	\N	2026-01-16 23:34:35.038
4646	Shinnosuke Ogasawara	WSN	2026-01-23 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	10	2026-01-20 14:00:00	2026-01-23 02:04:48.414
4749	Jose Castillo	4TM	2026-01-26 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	32	0	10	2026-01-23 14:00:00	2026-01-26 02:14:55.075
1459	Chris Sale	ATL	2025-12-28 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	1.9104698e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125	0	4	\N	2026-01-15 05:31:12.925
1463	Jon Singleton	HOU	2025-12-28 01:00:00	f	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	56	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	4	\N	2026-01-15 05:31:12.925
1469	Scott Barlow	CIN	2025-12-28 01:10:00	f	388f55c3-52e1-499f-8a56-948636a8c205	54	2025-12-25 21:07:52.542285	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	4	\N	2026-01-15 05:31:12.925
1482	Leo Rivas	SEA	2025-12-28 01:20:00	f	388f55c3-52e1-499f-8a56-948636a8c205	55	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	90	4	\N	2026-01-15 05:31:12.925
1464	Seth Lugo	KCR	2025-12-28 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	1.2913587e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	145	0	4	\N	2026-01-15 05:31:12.925
1465	David Morgan	SDP	2025-12-28 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	4	\N	2026-01-15 05:31:12.925
1466	Roddery Munoz	STL	2025-12-28 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	\N	2026-01-15 05:31:12.925
1467	Jose De Leon	BOS	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	\N	2026-01-15 05:31:12.925
1468	Caleb Freeman	CHW	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	\N	2026-01-15 05:31:12.925
1495	Emilio Pagan	CIN	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	3.384777e+06	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1470	Drew Waters	KCR	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	206	4	\N	2026-01-15 05:31:12.925
1473	Jorge Alcala	3TM	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	55	0	4	\N	2026-01-15 05:31:12.925
1474	Zac Gallen	ARI	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	8.879935e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	192	0	4	\N	2026-01-15 05:31:12.925
1475	Justin Foscue	TEX	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	4	\N	2026-01-15 05:31:12.925
1476	Caleb Boushley	TEX	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	4	\N	2026-01-15 05:31:12.925
1477	Cal Stevenson	PHI	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	\N	2026-01-15 05:31:12.925
1478	Michael Mercado	PHI	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	\N	2026-01-15 05:31:12.925
1479	Connor Seabold	2TM	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	\N	2026-01-15 05:31:12.925
1480	Rob Brantly	MIA	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	4	\N	2026-01-15 05:31:12.925
1496	James McCann	ARI	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	123	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1483	Jose Leclerc	ATH	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	\N	2026-01-15 05:31:12.925
1484	Yerry De los Santos	NYY	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	4	\N	2026-01-15 05:31:12.925
1485	Tomoyuki Sugano	BAL	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	157	0	4	\N	2026-01-15 05:31:12.925
1497	Carlos Cortes	ATH	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	94	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1487	Grant Wolfram	BAL	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	4	\N	2026-01-15 05:31:12.925
1488	Yuki Matsui	SDP	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	481200	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	63	0	4	\N	2026-01-15 05:31:12.925
1489	Yordan Alvarez	HOU	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	165	4	\N	2026-01-15 05:31:12.925
1490	Touki Toussaint	LAA	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	\N	2026-01-15 05:31:12.925
1492	J.P. France	HOU	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	\N	2026-01-15 05:31:12.925
1493	Jose Rances Suarez	ATL	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	4	\N	2026-01-15 05:31:12.925
1498	Scott Effross	NYY	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1499	Nicky Lopez	2TM	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	24	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1501	Steward Berroa	MIL	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	5	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1502	Oliver Dunn	MIL	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	36	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1503	Amed Rosario	2TM	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	181	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1504	Owen White	CHW	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1505	Lane Thomas	CLE	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	125	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1506	Wade Miley	CIN	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1507	Max Steven Muncy	LAD	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	4.38391e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	313	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1508	Tony Gonsolin	LAD	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1509	Michael Fulmer	2TM	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1511	Jordan Weems	HOU	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1513	Rico Garcia	3TM	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1514	Albert Suarez	BAL	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1515	Tayler Scott	2TM	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	27	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1516	Randy Wynne	CIN	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1517	Elvis Peguero	2TM	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1518	Owen Miller	COL	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	14	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1519	Lou Trivino	3TM	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
4371	David Morgan	SDP	2026-01-15 02:00:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	307	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4365	Chris Sale	ATL	2026-01-15 02:00:00	f	7779ed21-af49-4fbd-8127-c5a869384569	122	2026-01-11 23:29:34.496295	2.2476116e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	125	0	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4709	Triston McKenzie	CLE	2026-01-25 02:00:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	1667	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-22 14:00:00	2026-01-25 02:27:20.948
4788	Brent Suter	CIN	2026-01-27 02:10:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	2655	2026-01-11 23:29:34.496295	659298	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	10	2026-01-24 14:10:00	2026-01-27 03:01:31.528
1521	Yuli Gurriel	SDP	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	36	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1531	Max Scherzer	TOR	2025-12-30 01:00:00	f	388f55c3-52e1-499f-8a56-948636a8c205	66	2025-12-25 21:07:52.542285	678240	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	85	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1523	Juan Morillo	ARI	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1524	Ryan Gusto	2TM	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	101	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1525	Adam Ottavino	NYY	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1526	Justin Topa	MIN	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	759229	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	60	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1527	Mark Leiter Jr.	NYY	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	403608	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1530	Endy Rodriguez	PIT	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	52	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1532	Kevin Gausman	TOR	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	1.6520056e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	193	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1522	Cedric Mullins	2TM	2025-12-29 01:30:00	f	388f55c3-52e1-499f-8a56-948636a8c205	65	2025-12-25 21:07:52.542285	2.697591e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	435	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1494	Carlos Rodon	NYY	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	2.04e+07	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	195	0	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1460	Carlos Estevez	KCR	2025-12-28 01:00:00	f	7779ed21-af49-4fbd-8127-c5a869384569	64	2025-12-25 21:07:52.542285	4.604518e+06	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	66	0	4	\N	2026-01-15 05:31:12.925
1537	Hunter Strickland	LAA	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1538	Jaden Hill	COL	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1539	Scott Kingery	LAA	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	27	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1541	Caesar Prieto	STL	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1542	Marcell Ozuna	ATL	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	5.529954e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	487	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1543	Julian Fernandez	2TM	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1545	Randy Dobnak	MIN	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1546	DJ LeMahieu	NYY	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	128	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1547	Carlos Santana	2TM	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	5.468694e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	415	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1548	Connor Brogdon	LAA	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1549	Scott McGough	2TM	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1550	Alex Verdugo	ATL	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	197	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1551	Austin Pope	ARI	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1552	Billy Cook	PIT	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1553	Daz Cameron	MIL	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	41	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1555	Carson Ragsdale	BAL	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1556	Austin Barnes	LAD	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	42	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1558	Tomos Nido	DET	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	35	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1559	Javier Assad	CHC	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1560	Cam Sanders	PIT	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1561	Danny Young	NYM	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1562	Luis Guillorme	HOU	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1563	Ryan Vilade	2TM	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	13	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1565	Oswald Peraza	2TM	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	244	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1566	Sean Bouchard	COL	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	66	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1567	Luis Garcia	HOU	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1568	Matt Gorski	PIT	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	41	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1569	Dillon Tate	TOR	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1570	Evan Sisk	2TM	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1571	Brett Sullivan	PIT	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1572	Mark Canha	KCR	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	113	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1575	Michel Otanez	ATH	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1576	Max Kranick	NYM	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1577	Julian Merryweather	CHC	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1578	Justin Bruihl	TOR	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1579	Kyle Nelson	ARI	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1580	Zack Kelly	BOS	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1581	Sean Guenther	DET	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1582	Jonathan Loaisiga	NYY	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1583	Tanner Scott	LAD	2025-12-31 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	2.952433e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	57	0	4	2025-12-28 13:10:00	2026-01-15 05:31:12.925
1585	Jon Gray	TEX	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1586	John Curtiss	ARI	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1587	Luarbert Arias	MIA	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1588	Emmanuel Rivera	BAL	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	120	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1589	Enmanuel Valdez	PIT	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	91	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1590	Ji Hwan Bae	PIT	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1592	Jesse Winker	NYM	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	70	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1594	Allan Winans	NYY	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1595	Frankie Montas	NYM	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1596	Eric Lauer	TOR	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	1.848417e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	104	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1597	Forrest Whitley	2TM	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1598	Grant Holmes	ATL	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	2.161e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	115	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1599	Nick Martinez	CIN	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	1.3928991e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	165	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1600	Brandon Waddell	NYM	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1601	Jesse Chavez	ATL	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1602	Liam Hendriks	BOS	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1604	Taylor Trammell	HOU	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	117	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1605	Carl Edwards Jr.	2TM	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1606	Bryan Baker	2TM	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1607	Vinny Capra	2TM	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	96	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1534	Alek Jacob	SDP	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	33	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1536	Jared Shuster	CHW	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1611	Daniel Robert	PHI	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1613	Bryan Hoeing	SDP	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1614	Brewer Hicklen	DET	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	3	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1615	Esteury Ruiz	LAD	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1616	Seth Brown	ATH	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	65	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1618	Will Robertson	2TM	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	70	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1619	Jacob Hurtubise	CIN	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	12	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1620	Justin Verlander	SFG	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	5.229984e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	152	0	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1621	Jason Heyward	SDP	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	85	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1622	Matt Gage	2TM	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1623	Lazaro Estrada	TOR	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1624	Ryan Borucki	2TM	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1625	Ian Gibaut	CIN	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1626	J.D. Davis	LAA	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1629	Joel Payamps	2TM	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1630	Anthony Veneziano	2TM	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1631	Scott Alexander	2TM	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1632	Carlos Hernandez	3TM	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1633	Joel Peguero	SFG	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1634	Joe Mantiply	ARI	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1635	Colin Selby	BAL	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1636	Dane Dunning	2TM	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1638	Chris Stratton	2TM	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1639	Corey Julks	CHW	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	12	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1640	Jason Alexander	2TM	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	412000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	77	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1641	Ian Hamilton	NYY	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	40	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1642	Martin Perez	CHW	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	56	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1643	Grant Holman	ATH	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1644	Carter Kieboom	LAA	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1647	Luken Baker	STL	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	34	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1648	Sammy Peralta	LAA	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1649	Elvin Rodriguez	2TM	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1650	Nolan Arenado	STL	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	3.518755e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	401	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1651	Eduarniel Nunez	2TM	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1652	Craig Kimbrel	2TM	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1653	Miguel Castro	CHW	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1654	Donovan Walton	PHI	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1655	Manuel Margot	DET	2026-01-02 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	19	4	2025-12-30 13:10:00	2026-01-15 05:31:12.925
1657	Jake Woodford	ARI	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1658	Cody Bolton	CLE	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1660	Eduardo Salazar	WSN	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1661	Jesse Scholtens	TBR	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1662	Vimael Machin	BAL	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	11	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1663	Kevin Pillar	TEX	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	43	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1665	Logan Gillaspie	SDP	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1667	CJ Stubbs	WSN	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	3	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1668	Kendall Graveman	ARI	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1669	Matt Sauer	LAD	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1670	Ildemaro Vargas	ARI	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	115	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1671	Lucas Gilbreath	COL	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1672	Ryan Fitzgerald	MIN	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	46	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1673	Mike Trout	LAA	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	3.186207e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	456	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1674	Tyler Zuber	2TM	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1676	Bruce Zimmermann	MIL	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1677	Spencer Turnbull	TOR	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1678	Corbin Martin	BAL	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1679	Blake Treinen	LAD	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1680	Aaron Nola	PHI	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	6.284332e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	94	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1609	Luke Maile	KCR	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	45	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1610	Dauri Moreta	PIT	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
4366	Carlos Estevez	KCR	2026-01-15 02:00:00	f	388f55c3-52e1-499f-8a56-948636a8c205	197	2026-01-11 23:29:34.496295	5.41708e+06	2	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	66	0	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
1688	DaShawn Keirsey Jr.	MIN	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	84	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1689	Rowdy Tellez	2TM	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	289	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1690	Raisel Iglesias	ATL	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	5.371276e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1691	Ezequiel Duran	TEX	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1692	Ali Sanchez	2TM	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	23	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1694	Seth Martinez	MIA	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1695	Tommy Pham	PIT	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	606000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	392	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1696	Kodai Senga	NYM	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	5.58954e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	113	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1697	Lyon Richardson	CIN	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1698	Chris Roycroft	STL	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	20	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1699	Patrick Corbin	TEX	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	698240	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	155	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1700	Nic Enright	CLE	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1701	Joc Pederson	TEX	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	265	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1703	Ryan Pressly	CHC	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	41	0	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1704	Luke Raley	SEA	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	183	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1706	McCade Brown	COL	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1707	Ryan McMahon	2TM	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	5.318518e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	509	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1708	Hyeseong Kim	LAD	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	161	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1709	Jesse Hahn	SEA	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1710	Zack Short	HOU	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	50	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1711	Nick Raquet	STL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1713	Matt Waldron	SDP	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1714	Aaron Schunk	COL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	32	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1715	Miles Mikolas	STL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	700000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	156	0	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1716	Antonio Senzatela	COL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	130	0	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1717	Tyler Black	MIL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1718	Adam Frazier	2TM	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	888523	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	419	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1719	CJ Alexander	ATH	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	17	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1720	Zach Maxwell	CIN	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1722	J.C. Escarra	NYY	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	84	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1723	Brian Van Belle	TBR	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1725	Bryan De La Cruz	ATL	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	47	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1726	Dairon Blanco	KCR	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1727	Andres Gimenez	TOR	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	5.449527e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	329	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1728	Drew Avans	2TM	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	17	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1729	Nick Burdi	BOS	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1730	Jose Altuve	HOU	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	5.69622e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	588	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1731	Tyler Callihan	CIN	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1733	Kyle Gibson	BAL	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1734	Daniel Johnson	2TM	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	53	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1735	David Banuelos	BAL	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1736	Scott Blewett	3TM	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	0	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1737	David Robertson	PHI	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1739	Carson Spiers	CIN	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1741	Chadwick Tromp	2TM	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	21	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1743	Tanner Rainey	2TM	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1744	Nick Maton	CHW	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	54	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1745	Isaiah Campbell	BOS	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1749	Donovan Solano	2TM	2026-01-05 01:00:00	f	4f229366-dbe3-4361-84cb-115cab42685f	69	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	166	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1747	Justin Garza	NYM	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1748	Luis Vazquez	BAL	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1750	Brooks Kriske	2TM	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1752	Tim Mayza	2TM	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1753	Shinnosuke Ogasawara	WSN	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1754	Connor Wong	BOS	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	168	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1755	Cole Sulser	TBR	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1756	Nabil Crismatt	ARI	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1684	Jonathan Ornelas	2TM	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1685	Trenton Brooks	SDP	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	41	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1761	Tucker Barnhart	TEX	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	13	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1762	Greg Allen	BAL	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	14	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1764	Stuart Fairchild	ATL	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	51	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1765	Jesus Tinoco	MIA	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1766	Freddie Freeman	LAD	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	1.68041e+07	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	556	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1767	Jacob deGrom	TEX	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	9.764327e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	172	0	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1769	Mike Clevinger	CHW	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1770	Joshua Palacios	CHW	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	128	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1771	Elias Diiaz	SDP	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	255	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1772	Gerson Garabito	TEX	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1773	Joe Ross	PHI	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	408800	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	51	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1774	Xzavion Curry	MIA	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1775	Mason Thompson	WSN	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1776	Michael Tonkin	MIN	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1777	Alan Trejo	COL	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	40	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1779	Zak Kent	CLE	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1781	Nate Pearson	CHC	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1782	Cody Freeman	TEX	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	114	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1783	Jose Siri	NYM	2026-01-06 01:00:00	f	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	71	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	32	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1784	Hector Neris	3TM	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1785	Trent Thornton	SEA	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1786	Dom Nunez	CLE	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1787	Nick Solak	PIT	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	11	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1789	Bryse Wilson	CHW	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	47	0	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1790	Cody Poteet	BAL	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1791	Samad Taylor	SEA	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1792	Chris Devenski	NYM	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1793	Tirso Ornelas	SDP	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	14	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1794	Andrew Heaney	2TM	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	122	0	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1795	Jorge Barrosa	ARI	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	71	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1798	Josh Walker	TOR	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1799	Tommy Nance	TOR	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1800	Kyle Hendricks	LAA	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	2.659937e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	164	0	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1801	Zach Dezenzo	HOU	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	98	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1802	Ben Bowden	ATH	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1803	Tanner Gordon	COL	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	75	0	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1804	Ryan Noda	2TM	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	47	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1805	Joey Wiemer	MIA	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	55	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1806	Codi Heuer	2TM	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1808	Brett de Geus	PHI	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1810	Tom Cosgrove	CHC	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1811	Rob Zastryzny	MIL	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1813	Chad Wallach	LAA	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1814	Carlos Rodriguez	MIL	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1815	Dugan Darnell	COL	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1816	Yu Darvish	SDP	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	713152	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	72	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1818	Jose Barrero	STL	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	29	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1819	Lucas Sims	WSN	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1895	Sandy Leon	ATL	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	12	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1820	Triston McKenzie	CLE	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1821	Chris Taylor	2TM	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	113	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1822	Bobby Dalbec	CHW	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1823	Jack Suwinski	PIT	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	150	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1824	Richard Lovelady	2TM	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1825	Will Banfield	CIN	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1827	Nick Sandlin	TOR	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1828	Luis Felipe Castillo	SEA	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1829	Nate Eaton	BOS	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	81	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1830	Andres Munoz	SEA	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	7.610239e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	62	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1759	Freddy Tarnok	MIA	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1760	Ryan Rolison	COL	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1837	Ethan Roberts	CHC	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1838	George Soriano	MIA	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1839	Buddy Kennedy	3TM	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	29	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1840	Tayler Saucedo	SEA	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1842	Drew Rasmussen	TBR	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	1.3311673e+07	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	150	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1843	Nick Hernandez	HOU	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1844	Matt Olson	ATL	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	2.203689e+07	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	624	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1845	Jorge Alfaro	WSN	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	39	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1846	Brett Wisely	2TM	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	54	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1847	Connor Joe	2TM	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	70	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1848	Eddie Rosario	2TM	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1849	Tyler Matzek	NYY	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1851	Marcus Stroman	NYY	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	39	0	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1852	Keston Hiura	COL	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1853	Huascar Brazoban	NYM	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	700000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	63	0	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1854	Cooper Hummel	2TM	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	88	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1856	Justin Dean	LAD	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1857	Marc Church	TEX	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1858	T.J. McFarland	ATH	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1859	Jacob Stallings	2TM	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	119	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1861	Travis d'Arnaud	LAA	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	213	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1862	Jose Castillo	4TM	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	32	0	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1863	Beau Brieske	DET	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	22	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1864	Yaramil Hiraldo	BAL	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1865	A.J. Minter	NYM	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1866	Keaton Winn	SFG	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1867	Anthony Misiewicz	MIN	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1868	Victor Mederos	LAA	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1870	Jordan Hicks	2TM	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1871	Sam Moll	CIN	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1873	Gavin Hollowell	CHC	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1874	Seth Johnson	PHI	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1875	Christian Montes De Oca	ARI	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1876	Jarred Kelenic	ATL	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	60	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1877	Matt Krook	ATH	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1878	Aramis Garcia	ARI	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	4	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1880	Ian Anderson	LAA	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1881	Teoscar Hernandez	LAD	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	3.960304e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	511	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1882	Terrin Vavra	BAL	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1883	Nick Martini	COL	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	102	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1884	Taylor Rogers	2TM	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	600000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	50	0	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1885	Michael Stefanic	TOR	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	22	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1886	Jonathan Bowlan	KCR	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	44	0	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1888	Trevor Williams	WSN	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	757375	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	82	0	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1889	Jose Ruiz	2TM	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1891	Geoff Hartlieb	2TM	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1892	Alex Carrillo	NYM	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1893	Erik Swanson	TOR	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1894	Jhonny Pereda	2TM	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	69	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1896	Bailey Ober	MIN	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	8.362016e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	146	0	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1897	Kike Hernandez	LAD	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	232	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1898	Garrett Stubbs	PHI	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	1	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1899	Kyle Hart	SDP	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1901	MJ Melendez	KCR	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	60	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1902	Brian Navarreto	MIA	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	14	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1903	Penn Murfee	CHW	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1904	Brent Suter	CIN	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	659298	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1833	J.P. Feyereisen	2TM	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1834	Jeff Brigham	ARI	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1471	Evan Phillips	LAD	2025-12-28 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	\N	2026-01-15 05:31:12.925
1481	Blake Sabol	BOS	2025-12-28 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	16	4	\N	2026-01-15 05:31:12.925
1491	Pablo Reyes	NYY	2025-12-28 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	31	4	\N	2026-01-15 05:31:12.925
1910	Gregory Santos	SEA	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	7	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1911	Jose Quijada	LAA	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1912	Robert Stock	BOS	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1913	Craig Yoho	MIL	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1914	Luis Contreras	HOU	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	12	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1915	Coco Montes	TBR	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	10	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1917	Zach Pop	2TM	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1918	Kaleb Ort	HOU	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	46	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1919	Ronel Blanco	HOU	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	48	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1920	Tommy Henry	ARI	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1921	Rich Hill	KCR	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1922	Kenta Maeda	DET	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1924	Justin Hagenman	NYM	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	0	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1925	Petey Halpin	CLE	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	6	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1927	Alan Rangel	PHI	2026-01-10 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1928	Greg Jones	CHW	2026-01-10 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	2	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1929	Leo Jimenez	TOR	2026-01-10 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	29	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1930	Ryan Burr	TOR	2026-01-10 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1936	Sam Hilliard	COL	2026-01-10 01:10:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	91	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	51	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1931	Andrew Knizner	SFG	2026-01-10 01:00:00	f	6f591686-4009-4693-a2c7-d3eb1b36073f	87	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	77	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1933	Willi Castro	2TM	2026-01-10 01:00:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	99	2025-12-25 21:07:52.542285	1.500055e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	402	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1937	Bryan Hudson	2TM	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	15	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1938	Casey Lawrence	2TM	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1951	Willy Adames	SFG	2026-01-10 01:20:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	100	2025-12-25 21:07:52.542285	3.214915e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	591	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1941	Chase Lee	DET	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1942	Justin Lawrence	PIT	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	17	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1943	Konnor Pilkington	WSN	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	28	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1944	Wander Suero	ATL	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1945	Joe La Sorsa	CIN	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1947	Trevor Richards	2TM	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1948	Easton McGee	MIL	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1950	Austin Cox	ATL	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1962	Christian Walker	HOU	2026-01-10 01:30:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	75	2025-12-25 21:07:52.542285	6.919101e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	585	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1952	Genesis Cabrera	4TM	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	42	0	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1953	Niko Kavadas	LAA	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1954	Hunter Feduccia	2TM	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	88	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1955	Matt Vierling	DET	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	88	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1958	Anthony DeSclafani	ARI	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	38	0	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1959	Ryan Kreidler	DET	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	38	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1960	Cionel Perez	BAL	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	21	0	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1961	Carson Fulmer	LAA	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	29	0	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1963	Jayden Murray	HOU	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1500	Colin Holderman	PIT	2025-12-29 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	25	0	4	2025-12-26 13:00:00	2026-01-15 05:31:12.925
1510	Jose Azacar	2TM	2025-12-29 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	19	4	2025-12-26 13:10:00	2026-01-15 05:31:12.925
1520	Charlie Morton	3TM	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	544612	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	142	0	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1529	Shawn Dubin	2TM	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	33	0	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1533	Logan Porter	SFG	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1535	Matt Bowman	BAL	2025-12-30 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	24	0	4	2025-12-27 13:00:00	2026-01-15 05:31:12.925
1544	Anthony Molina	COL	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1554	Kenley Jansen	LAA	2025-12-30 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	4.747111e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	59	0	4	2025-12-27 13:20:00	2026-01-15 05:31:12.925
1564	Nathan Wiles	ATL	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1584	Collin Snider	SEA	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1908	Shelby Miller	2TM	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	46	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1909	Hoby Milner	TEX	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	70	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1458	Randal Grichuk	2TM	2025-12-28 01:00:00	f	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	59	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	272	4	\N	2026-01-15 05:31:12.925
1486	Hayden Senger	NYM	2025-12-28 01:30:00	f	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	57	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	72	4	\N	2026-01-15 05:31:12.925
1637	Tyler Anderson	LAA	2026-01-01 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	4.916636e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	136	0	4	2025-12-29 13:30:00	2026-01-15 05:31:12.925
1645	Daysbel Hernandez	ATL	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	37	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1646	Zach Thompson	ATL	2026-01-02 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2025-12-30 13:00:00	2026-01-15 05:31:12.925
1656	Luke Williams	ATL	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	31	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1664	Daniel Lynch IV	KCR	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	739000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	67	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1666	Drey Jameson	ARI	2026-01-02 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2025-12-30 13:30:00	2026-01-15 05:31:12.925
1675	Jordyn Adams	BAL	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	5	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1681	Gustavo Campero	LAA	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	58	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1682	Chris Flexen	CHC	2026-01-03 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	4	2025-12-31 13:00:00	2026-01-15 05:31:12.925
1683	Alex Lange	DET	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1687	Sebastian Rivero	LAA	2026-01-03 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	33	4	2025-12-31 13:10:00	2026-01-15 05:31:12.925
1693	Roki Sasaki	LAD	2026-01-03 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	36	0	4	2025-12-31 13:20:00	2026-01-15 05:31:12.925
1702	Mason McCoy	SDP	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	22	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1712	Luis Peralta	COL	2026-01-04 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	4	2026-01-01 13:00:00	2026-01-15 05:31:12.925
1721	Masataka Yoshida	BOS	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	188	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1732	Shaun Anderson	LAA	2026-01-04 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-01 13:20:00	2026-01-15 05:31:12.925
1742	Joey Gerber	TBR	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1751	Connor Kaiser	ARI	2026-01-05 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1757	Thomas Hatch	2TM	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1758	Jayvien Sandridge	NYY	2026-01-05 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	0	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1768	Orlando Arcia	2TM	2026-01-05 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	203	4	2026-01-02 13:20:00	2026-01-15 05:31:12.925
1778	Jose Iglesias	SDP	2026-01-05 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	701000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	306	4	2026-01-02 13:30:00	2026-01-15 05:31:12.925
1788	Eric Haase	MIL	2026-01-06 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	70	4	2026-01-03 13:00:00	2026-01-15 05:31:12.925
1797	Yohel Pozo	STL	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	160	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1807	Bob Seymour	TBR	2026-01-06 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	78	4	2026-01-03 13:20:00	2026-01-15 05:31:12.925
1817	Erasmo Ramirez	MIN	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1832	Sauryn Lao	2TM	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1841	Jake Palisch	CHW	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1850	Billy McKinney	TEX	2026-01-07 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	4	2026-01-04 13:30:00	2026-01-15 05:31:12.925
1860	Kevin Herget	2TM	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	13	0	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1869	Michael Lorenzen	KCR	2026-01-08 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	3.262117e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	141	0	4	2026-01-05 13:10:00	2026-01-15 05:31:12.925
1879	Nick Paul Anderson	COL	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	14	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1890	Jose Urquidy	DET	2026-01-09 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2026-01-06 13:00:00	2026-01-15 05:31:12.925
1900	Taylor Rashi	ARI	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	16	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1906	Jameson Taillon	CHC	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	5.430954e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	129	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1907	John Rooney	HOU	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1916	Austin Warren	NYM	2026-01-09 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-06 13:20:00	2026-01-15 05:31:12.925
1926	Weston Wilson	PHI	2026-01-10 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	111	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1935	Jeremiah Jackson	BAL	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	170	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1946	Johan Rojas	PHI	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	152	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1763	Justin Turner	CHC	2026-01-05 01:10:00	f	4f229366-dbe3-4361-84cb-115cab42685f	70	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	169	4	2026-01-02 13:10:00	2026-01-15 05:31:12.925
1512	Nick Ahmed	TEX	2025-12-29 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	4	2025-12-26 13:20:00	2026-01-15 05:31:12.925
1528	Cesar Salazar	HOU	2025-12-29 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	13	4	2025-12-26 13:30:00	2026-01-15 05:31:12.925
1540	Cam Booser	CHW	2025-12-30 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	31	0	4	2025-12-27 13:10:00	2026-01-15 05:31:12.925
1557	Angel Perdomo	ATH	2025-12-30 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2025-12-27 13:30:00	2026-01-15 05:31:12.925
1573	Michael Petersen	2TM	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	18	0	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1574	Andrew McCutchen	PIT	2025-12-31 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	586191	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	477	4	2025-12-28 13:00:00	2026-01-15 05:31:12.925
1591	Jose Fermin	LAA	2025-12-31 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	34	0	4	2025-12-28 13:20:00	2026-01-15 05:31:12.925
1593	Rafael Montero	3TM	2025-12-31 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	60	0	4	2025-12-28 13:30:00	2026-01-15 05:31:12.925
1603	Robinson Pina	2TM	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1608	Ryan Helsley	2TM	2026-01-01 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	3.307603e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	56	0	4	2025-12-29 13:00:00	2026-01-15 05:31:12.925
1612	Reynaldo Lopez	ATL	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1617	Jared Young	NYM	2026-01-01 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	43	4	2025-12-29 13:10:00	2026-01-15 05:31:12.925
1627	Gio Urshela	ATH	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	181	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1628	Travis Jankowski	3TM	2026-01-01 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	45	4	2025-12-29 13:20:00	2026-01-15 05:31:12.925
1705	Sergio Alcantara	SFG	2026-01-03 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	4	4	2025-12-31 13:30:00	2026-01-15 05:31:12.925
1724	John Brebbia	2TM	2026-01-04 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	23	0	4	2026-01-01 13:10:00	2026-01-15 05:31:12.925
1740	Abraham Toro	BOS	2026-01-04 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	259	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1796	Omar Cruz	SDP	2026-01-06 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-03 13:10:00	2026-01-15 05:31:12.925
1812	Reiver Sanmartin	CIN	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1826	Andres Chaparro	WSN	2026-01-07 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	66	4	2026-01-04 13:00:00	2026-01-15 05:31:12.925
1831	Ty Adcock	NYM	2026-01-07 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-04 13:10:00	2026-01-15 05:31:12.925
1836	Jurickson Profar	ATL	2026-01-07 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	3.322322e+06	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	318	4	2026-01-04 13:20:00	2026-01-15 05:31:12.925
1855	Jose Espada	BAL	2026-01-08 01:00:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	4	2026-01-05 13:00:00	2026-01-15 05:31:12.925
1872	Juan Mejia	COL	2026-01-08 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	598124	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	61	0	4	2026-01-05 13:20:00	2026-01-15 05:31:12.925
1887	Anthony Maldonado	ATH	2026-01-08 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	4	2026-01-05 13:30:00	2026-01-15 05:31:12.925
1905	Andrew Kittredge	2TM	2026-01-09 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	1.558514e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	53	0	4	2026-01-06 13:10:00	2026-01-15 05:31:12.925
1923	Tim Anderson	LAA	2026-01-09 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	83	4	2026-01-06 13:30:00	2026-01-15 05:31:12.925
1940	Jovani Moran	BOS	2026-01-10 01:10:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
1956	David Villar	SFG	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	20	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1957	Dedniel Nunez	NYM	2026-01-10 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	4	2026-01-07 13:30:00	2026-01-15 05:31:12.925
1738	Akil Baddoo	DET	2026-01-04 01:30:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	67	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	17	4	2026-01-01 13:30:00	2026-01-15 05:31:12.925
1746	John Schreiber	KCR	2026-01-05 01:00:00	f	4f229366-dbe3-4361-84cb-115cab42685f	68	2025-12-25 21:07:52.542285	740000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	64	0	4	2026-01-02 13:00:00	2026-01-15 05:31:12.925
1932	Austin Gomber	COL	2026-01-10 01:00:00	f	e2831203-b5bb-4911-9a98-485fe4c6e3b5	73	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	57	0	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
1939	Jonah Bride	2TM	2026-01-10 01:10:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	101	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	112	4	2026-01-07 13:10:00	2026-01-15 05:31:12.925
4374	Scott Barlow	CIN	2026-01-15 02:10:00	f	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	339	2026-01-11 23:29:34.496295	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	68	0	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4398	Jose Rances Suarez	ATL	2026-01-15 02:30:00	f	c532b6f7-bdfb-4505-b43f-f653770c03af	391	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	19	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4387	Leo Rivas	SEA	2026-01-15 02:20:00	f	388f55c3-52e1-499f-8a56-948636a8c205	215	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	111	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4376	Evan Phillips	LAD	2026-01-15 02:10:00	f	cc78d40c-9179-4616-9834-9aa9c69963fa	340	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	5	0	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4391	Hayden Senger	NYM	2026-01-15 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	78	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4396	Pablo Reyes	NYY	2026-01-15 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	34	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4386	Blake Sabol	BOS	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	18	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4378	Jorge Alcala	3TM	2026-01-15 02:10:00	f	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	363	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	55	0	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4372	Roddery Munoz	STL	2026-01-15 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	11	0	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4373	Jose De Leon	BOS	2026-01-15 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6	0	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4390	Tomoyuki Sugano	BAL	2026-01-15 02:30:00	f	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	367	2026-01-11 23:29:34.496295	500000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	157	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4375	Drew Waters	KCR	2026-01-15 02:10:00	f	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	378	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	219	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4394	Yordan Alvarez	HOU	2026-01-15 02:30:00	f	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	390	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	199	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4380	Justin Foscue	TEX	2026-01-15 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	9	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4381	Caleb Boushley	TEX	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	43	0	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4382	Cal Stevenson	PHI	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	8	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4383	Michael Mercado	PHI	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	0	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4384	Connor Seabold	2TM	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	10	0	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4385	Rob Brantly	MIA	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4388	Jose Leclerc	ATH	2026-01-15 02:20:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	9	0	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4392	Grant Wolfram	BAL	2026-01-15 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	26	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4395	Touki Toussaint	LAA	2026-01-15 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4397	J.P. France	HOU	2026-01-15 02:30:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	4	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
4377	Gary Sanchez	BAL	2026-01-15 02:10:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	101	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
1659	Jhonathan Diaz	SEA	2026-01-02 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	1	0	4	2025-12-30 13:20:00	2026-01-15 05:31:12.925
1809	Johnathan Rodriguez	CLE	2026-01-06 01:30:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	71	4	2026-01-03 13:30:00	2026-01-15 05:31:12.925
1949	Luis Vazquez	BAL	2026-01-10 01:20:00	t	\N	\N	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	50	4	2026-01-07 13:20:00	2026-01-15 05:31:12.925
1934	Omar Narvaez	CHW	2026-01-10 01:00:00	f	0477609b-080d-4cd2-b891-117e615bdf47	85	2025-12-25 21:07:52.542285	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	7	4	2026-01-07 13:00:00	2026-01-15 05:31:12.925
4389	Yerry De los Santos	NYY	2026-01-15 02:20:00	f	4f229366-dbe3-4361-84cb-115cab42685f	322	2026-01-11 23:29:34.496295	400000	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	35	0	10	2026-01-12 14:20:00	2026-01-15 05:31:12.925
4368	Oscar Gonzalez	SDP	2026-01-15 02:00:00	t	\N	\N	2026-01-11 23:29:34.496295	400000	1	hitter	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0	61	10	2026-01-12 14:00:00	2026-01-15 05:31:12.925
4379	Zac Gallen	ARI	2026-01-15 02:10:00	f	17faf686-27d1-4e30-a11c-4e7ec21ca685	174	2026-01-11 23:29:34.496295	8.879935e+06	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	192	0	10	2026-01-12 14:10:00	2026-01-15 05:31:12.925
4393	Yuki Matsui	SDP	2026-01-15 02:30:00	f	c4815f14-1981-43aa-b972-5f7a43ed0f13	350	2026-01-11 23:29:34.496295	481200	1	pitcher	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	63	0	10	2026-01-12 14:30:00	2026-01-15 05:31:12.925
\.


--
-- Data for Name: league_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.league_members (id, league_id, user_id, role, team_name, team_abbreviation, is_archived, created_at, updated_at) FROM stdin;
1	2	88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	owner	Bellagio Big Slick	BBS	f	2025-12-25 21:03:33.015844	2025-12-25 21:03:33.015844
2	2	ecd9a198-149e-45a9-8c43-c7c59dd8ca26	owner	Charlotte Hornets	CHA	f	2025-12-25 21:03:33.119026	2025-12-25 21:03:33.119026
3	2	928867ca-3fe1-4e87-ad16-b65e0f85c3f9	owner	Chicago Johns	CHI	f	2025-12-25 21:03:33.21432	2025-12-25 21:03:33.21432
4	2	02538c92-2a46-43e6-8351-33297d6de099	owner	Clinton Arrowheads	CLI	f	2025-12-25 21:03:33.314875	2025-12-25 21:03:33.314875
5	2	cec18033-5816-4170-97d9-81dcd4c2670b	owner	Delaware River Explorers	DEL	f	2025-12-25 21:03:33.410997	2025-12-25 21:03:33.410997
6	2	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	owner	Electric City Bolts	ECB	f	2025-12-25 21:03:33.506949	2025-12-25 21:03:33.506949
7	2	f335b9c3-7d63-44f3-9540-13b1d461ca13	owner	El Monte Pythons	EMP	f	2025-12-25 21:03:33.602419	2025-12-25 21:03:33.602419
9	2	e08f4fb4-f7df-4224-9a81-21c0f93cf810	owner	Jackson Chasers	JAC	f	2025-12-25 21:03:33.795826	2025-12-25 21:03:33.795826
10	2	c4815f14-1981-43aa-b972-5f7a43ed0f13	owner	Kellvery Patriots	WYO	f	2025-12-25 21:03:33.891634	2025-12-25 21:03:33.891634
11	2	e2831203-b5bb-4911-9a98-485fe4c6e3b5	owner	Lakemont Landsharks	LAK	f	2025-12-25 21:03:33.987489	2025-12-25 21:03:33.987489
12	2	39e9d5ca-8b3b-4b83-924f-d694c07d5bac	owner	Lancaster Red Roses	LRR	f	2025-12-25 21:03:34.08388	2025-12-25 21:03:34.08388
13	2	5fa86a6e-5f89-4762-a4f8-0c071ac6431c	owner	Maine Millwrights	MAI	f	2025-12-25 21:03:34.179793	2025-12-25 21:03:34.179793
14	2	a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	owner	Memphis Redbirds	MEM	f	2025-12-25 21:03:34.274952	2025-12-25 21:03:34.274952
15	2	d8be0952-18cc-4082-8a6c-5de14ea569ce	owner	South Florida Swordfish	SFS	f	2025-12-25 21:03:34.370331	2025-12-25 21:03:34.370331
16	2	c532b6f7-bdfb-4505-b43f-f653770c03af	owner	Newdle Buds	NEW	f	2025-12-25 21:03:34.465512	2025-12-25 21:03:34.465512
17	2	5084741d-1673-42b3-a8e3-3d422874e814	owner	Norridge Rebels	NOR	f	2025-12-25 21:03:34.560899	2025-12-25 21:03:34.560899
18	2	4f229366-dbe3-4361-84cb-115cab42685f	owner	Ponchatoula Gators	PON	f	2025-12-25 21:03:34.656972	2025-12-25 21:03:34.656972
19	2	51f792dc-04f3-467f-a604-631165c75b38	owner	Paris Texas Rangers	PTR	f	2025-12-25 21:03:34.75383	2025-12-25 21:03:34.75383
20	2	388f55c3-52e1-499f-8a56-948636a8c205	owner	Puget Sound Pigeons	PUG	f	2025-12-25 21:03:34.850399	2025-12-25 21:03:34.850399
21	2	889cd08b-6e70-4f4c-847f-363dbbe2c110	owner	Riverside Park Baseball Furies	RIV	f	2025-12-25 21:03:34.946621	2025-12-25 21:03:34.946621
22	2	cc78d40c-9179-4616-9834-9aa9c69963fa	owner	Sacramento Cats	SAC	f	2025-12-25 21:03:35.041945	2025-12-25 21:03:35.041945
23	2	ed7002d2-8e69-4ea5-a300-3c28d74b21e1	owner	San Diego Tourists	SAN	f	2025-12-25 21:03:35.137105	2025-12-25 21:03:35.137105
24	2	0477609b-080d-4cd2-b891-117e615bdf47	owner	Sarasota Solar Sox	SAR	f	2025-12-25 21:03:35.233012	2025-12-25 21:03:35.233012
25	2	7779ed21-af49-4fbd-8127-c5a869384569	owner	Stark County Slither	SCS	f	2025-12-25 21:03:35.328457	2025-12-25 21:03:35.328457
26	2	17faf686-27d1-4e30-a11c-4e7ec21ca685	owner	Sleepy Hollow Spiders	SHS	f	2025-12-25 21:03:35.424274	2025-12-25 21:03:35.424274
27	2	004ab9b5-0b85-4ce7-8bd2-abeb1075df18	owner	Silvio Mossas	SIL	f	2025-12-25 21:03:35.519866	2025-12-25 21:03:35.519866
28	2	45d0bd6f-b580-4e0d-8e9f-6a00705f669b	owner	Springfield Isotopes	SPR	f	2025-12-25 21:03:35.615626	2025-12-25 21:03:35.615626
29	2	5d77ac22-c768-4d3b-99d8-73c250a3e859	owner	St. Louis Arch Angels	STL	f	2025-12-25 21:03:35.711426	2025-12-25 21:03:35.711426
30	2	6f591686-4009-4693-a2c7-d3eb1b36073f	owner	Vancouver Canadins	VAN	f	2025-12-25 21:03:35.806755	2025-12-25 21:03:35.806755
8	2	dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	commissioner	Gilroy Garlic	GIL	f	2025-12-25 21:03:33.69724	2025-12-25 21:50:33.707
\.


--
-- Data for Name: league_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.league_settings (id, year_factor_1, year_factor_2, year_factor_3, year_factor_4, year_factor_5, updated_at, default_budget, enforce_budget) FROM stdin;
1	1	1.25	1.33	1.43	1.55	2025-12-04 15:14:14.206946	260	t
\.


--
-- Data for Name: leagues; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leagues (id, name, slug, timezone, created_by_id, created_at, updated_at, budget_cap, ip_cap, pa_cap) FROM stdin;
2	Cooperstown Baseball League	cooperstown-baseball-league	America/New_York	388f55c3-52e1-499f-8a56-948636a8c205	2025-12-25 00:51:24.652105	2026-01-12 19:27:52.725	116000	1700	7000
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token, expires_at, used_at, created_at) FROM stdin;
46	cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	4322f8249e264701714c4a08b1a34ad1a693d77c7a13c5d940ebf9fbaf9711b1	2026-01-26 16:32:32.674	2026-01-26 15:33:43.819	2026-01-26 15:32:32.689379
\.


--
-- Data for Name: roster_players; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roster_players (id, league_id, user_id, player_name, player_type, ip, pa, salary, contract_years, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
5yJNir_TvJcFsjQzBJQx5a1iZ5OAZk-E	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-22T18:58:59.512Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "e2831203-b5bb-4911-9a98-485fe4c6e3b5"}	2026-02-22 22:13:04
m6m8S3Bn_Ks-kd9TW9qSpDvz6T5GB5kP	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-11T04:04:44.474Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "45d0bd6f-b580-4e0d-8e9f-6a00705f669b"}	2026-02-16 20:56:27
m3yILGSGdFdpUZfKiO7GetLDqZVd1tpk	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-23T18:04:25.144Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "388f55c3-52e1-499f-8a56-948636a8c205"}	2026-02-23 18:12:28
MJqj6iLTO63_KT2rQmjGegx86sIumvFk	{"cookie": {"path": "/", "secure": true, "expires": "2026-02-20T01:02:53.842Z", "httpOnly": true, "sameSite": "lax", "originalMaxAge": 604800000}, "userId": "4f229366-dbe3-4361-84cb-115cab42685f"}	2026-02-20 01:05:00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, profile_image_url, is_commissioner, team_name, created_at, updated_at, password_hash, must_reset_password, is_super_admin, is_archived, team_abbreviation) FROM stdin;
ecd9a198-149e-45a9-8c43-c7c59dd8ca26	rwhite41161@gmail.com	Ron	White	\N	f	Charlotte Hornets	2025-12-25 20:36:28.791858	2025-12-25 20:36:28.791858	$2b$12$RN51QU6.4yKZZQAF3Ik0Ceif0Y7AYQPAvYwvXH898/rfYYpz/9Qmm	f	f	f	CHA
928867ca-3fe1-4e87-ad16-b65e0f85c3f9	John.Hartigan@sbcglobal.net	John	Hartigan	\N	f	Chicago Johns	2025-12-25 20:36:29.218935	2025-12-25 20:36:29.218935	$2b$12$0ejrjnbubHa5HH7V87ovM.kSH97J40qVl4/Q8ea6Gwa5H2LLT1LwO	f	f	f	CHI
889cd08b-6e70-4f4c-847f-363dbbe2c110	jaskillzz@gmail.com	John	Skillings	\N	f	Riverside Park Baseball Furies	2025-12-25 20:36:36.524254	2025-12-25 20:36:36.524254	$2b$12$YEKfSJKWeywiImSPXGhLqOzwk5mCrSmyZUWrTKWtEnNXM5KlVhXVi	f	f	f	RIV
388f55c3-52e1-499f-8a56-948636a8c205	caseyemalone@protonmail.com	Casey	Malone	\N	f	Puget Sound Pigeons	2025-12-04 18:39:54.948956	2025-12-05 21:15:56.79	$2b$12$XIum2xPpm2vejiXY3MmOAOVTkplsqmjaGhUR6DUaBuucNj1jROfpO	f	t	f	PUG
0477609b-080d-4cd2-b891-117e615bdf47	gatormanddd@comcast.net	Don	Decker	\N	f	Sarasota Solar Sox	2025-12-25 20:36:37.814395	2025-12-25 20:36:37.814395	$2b$12$7n3.tqlqh/qB9ZRicMhpmeEFbzdJ8sowsHsAPN974AaYVSB0n2V8.	f	f	f	SAR
45d0bd6f-b580-4e0d-8e9f-6a00705f669b	ogobby@att.net	Omar	Gobby	\N	f	Springfield Isotopes	2025-12-25 20:36:39.571734	2025-12-25 20:36:39.571734	$2b$12$hzKvbVKPfa84FwguLchVd.6LeTaQo6yAI3c0cw7NdNuDvyIqu7af2	f	f	f	SPR
4f229366-dbe3-4361-84cb-115cab42685f	jfletch86@gmail.com	JJ	Fletcher	\N	f	Ponchatoula Gators	2025-12-25 20:36:35.640456	2026-01-03 04:27:58.464	$2b$12$gBBSIazEtNgf8dq4nFunVOdJRldveb2dwk75NLwwxYscVjvy45OLK	f	f	f	PON
e2831203-b5bb-4911-9a98-485fe4c6e3b5	berniesheehe@gmail.com	Bernie	Sheehe	\N	f	Lakemont Landsharks	2025-12-25 20:36:32.63977	2026-01-03 12:58:07.47	$2b$12$GT0mAmaTTEhw0jgqW4JEaeKPJaSxPJoy4ggi.LBPORRwI73GYrhp6	f	f	f	LAK
dacce798-1f72-4e0c-ad06-ac4ec84e0c0e	tony.mannino1@verizon.net	Tony	Mannino	\N	t	Gilroy Garlic	2025-12-25 20:36:31.346671	2025-12-25 21:09:43.814	$2b$12$x5saKdh6I35YRVdctFkuZueIz6VCvOQBTuVffdb30yrOdi00kkV1y	f	f	f	GIL
7779ed21-af49-4fbd-8127-c5a869384569	ajake57@yahoo.com	Jason	Argue	\N	f	Stark County Slither	2025-12-25 20:36:38.296257	2025-12-27 20:30:40.418	$2b$12$Htwr1lJsfFYMkW9gr8NfVuzld8qxg/ScdU4rfU7Vff5K6T03x4P5O	f	f	f	SCS
ed7002d2-8e69-4ea5-a300-3c28d74b21e1	tobymickey1@gmail.com	Toby	Mickey	\N	f	San Diego Tourists	2025-12-25 20:36:37.389261	2026-01-03 14:42:24.199	$2b$12$exxq/Tu.JNKb/6qeHyFW3egJqpHW35t3Cv5rM8TMJYw22t/WYdAxO	f	f	f	SAN
cc78d40c-9179-4616-9834-9aa9c69963fa	melt12@comcast.net	Todd	Melton	\N	f	Sacramento Cats	2025-12-25 20:36:36.951677	2026-01-03 15:12:30.03	$2b$12$F02G5ZL4lSj0lt8pKzsL2eaa0ieb.skojQfeykR0h77abG0YlfHr6	f	f	f	SAC
a2139a38-1e7e-4de0-ad1c-c0f2c2135ed2	paperboy10189@gmail.com	Chris	Feeney	\N	f	Memphis Redbirds	2025-12-25 20:36:33.920671	2026-01-10 18:27:18.779	$2b$12$fmC22DV8VU0cRFFHVG.C7umGa0tYs8RZj3nY8t76O4t1sl1vDTxSW	f	f	f	MEM
17faf686-27d1-4e30-a11c-4e7ec21ca685	luke.dalfiume@yahoo.com	Luke	Dalfiume	\N	f	Sleepy Hollow Spiders	2025-12-25 20:36:38.721718	2026-01-04 06:23:32.073	$2b$12$NIqcxCmwc7mJuVwRgufj1eqXx0bBvPMphZ2Lw9tjahh49j78XhbqS	f	f	f	SHS
02538c92-2a46-43e6-8351-33297d6de099	etters96@yahoo.com	Kevin	Etters	\N	f	Clinton Arrowheads	2025-12-25 20:36:29.644732	2026-01-04 22:51:28.89	$2b$12$/dh/vm9wIjIc6OkcSeJaEeSjEUsODuiBwY3ilguWslm.w9PkCidsG	f	f	f	CLI
c532b6f7-bdfb-4505-b43f-f653770c03af	newdlebuds21@gmail.com	Mick	Newman	\N	f	Newdle Buds	2025-12-25 20:36:34.784615	2026-01-05 01:01:27.037	$2b$12$2HfbagavVnXPUfE81DiIUeg9yYsiJGuo0x6kd4Q5uDIMgIQeFUQ1O	f	f	f	NEW
cec18033-5816-4170-97d9-81dcd4c2670b	dberks@aol.com	Dave	Berks	\N	f	Delaware River Explorers	2025-12-25 20:36:30.068544	2026-01-05 02:11:20.609	$2b$12$LT.Bnaf1Cr1/gcUlp5jajeKGONut9Gr4BG6u/02QDDNT9SFOF/38u	f	f	f	DEL
88e8754c-3fea-40c6-b2d7-8a4c8ef448ad	jeffaweissdmd@aol.com	Jeff	Weiss	\N	f	Bellagio Big Slick	2025-12-25 20:36:28.346769	2026-01-05 16:37:30.655	$2b$12$o.nlpL/Y8uBcsFNWso6Lm.6Jc/W4KrkeFBNiAv8/GAHsN333KXU3i	f	f	f	BBS
c4815f14-1981-43aa-b972-5f7a43ed0f13	erocstrat@yahoo.com	Eric	Tobin	\N	f	Wyoming Jackalopes	2025-12-25 20:36:32.201932	2026-01-14 06:17:35.616	$2b$12$Y9KwB74zd4BNBEegCbRoYu8dhtzq3VefIu70KfkMTgQX4DKivQ3cS	f	f	f	WYO
51f792dc-04f3-467f-a604-631165c75b38	mcspuds98@aol.com	Kenneth	Eickholt	\N	f	Paris Texas Rangers	2025-12-25 20:36:36.068781	2026-01-09 14:45:46.607	$2b$12$X6QFCFTV7w0YPHt6i3kMKeZ6HjXPnw1pN2ifxn556Wcc6kuOcUgRu	f	f	f	PTR
5d77ac22-c768-4d3b-99d8-73c250a3e859	dvandeven5@gmail.com	Dale	Van Deven	\N	f	St. Louis Arch Angels	2025-12-25 20:36:40.002754	2026-01-09 20:17:49.451	$2b$12$UD16ijCyBXrf.b2RNSYIAu3uIqitIPpIMIbZ/oja6wWoqdEV5iB92	f	f	f	STL
6f591686-4009-4693-a2c7-d3eb1b36073f	linden.trojanoski@hotmail.com	Linden	Trojanoski	\N	f	Vancouver Canadins	2025-12-25 20:36:40.433516	2026-01-12 00:46:20.122	$2b$12$hwEXB2kFdDNs2Um9QMTVAe6u.SQMaQ4XZXVhOKR4uDqc2aeI2zfly	f	f	f	VAN
5084741d-1673-42b3-a8e3-3d422874e814	pauldran@aol.com	Paul	Draniczarek	\N	f	Norridge Rebels	2025-12-25 20:36:35.210877	2026-01-12 18:33:25.81	$2b$12$dayejKYA3oyocJuFA8F.OuuHssMcFBW/rZ5.luyvn/aabmWCZ8m8.	f	f	f	NOR
004ab9b5-0b85-4ce7-8bd2-abeb1075df18	silviomossa@att.net	Patrick	Tierney	\N	f	Silvio Mossas	2025-12-25 20:36:39.146847	2026-01-12 22:17:20.302	$2b$12$bM3bVw6ZWiN6CG2VavaFoO0wRRSIYNR6XC.6Fb95H4Ejs3yv1wQe2	f	f	f	SIL
39e9d5ca-8b3b-4b83-924f-d694c07d5bac	mathew.steven.lewis@gmail.com	Mat	Lewis	\N	f	Lancaster Red Roses	2025-12-25 20:36:33.066043	2026-01-13 03:06:56.606	$2b$12$AHhNs3yIxDYXTl8VTyBEg..m9z7Dm2b0/atv.nSIbPYU7t87NvdaO	f	f	f	LRR
5fa86a6e-5f89-4762-a4f8-0c071ac6431c	ksimone911@gmail.com	Ken	Simone	\N	f	Maine Millwrights	2025-12-25 20:36:33.493251	2026-01-13 17:17:42.756	$2b$12$5pEgOQtCw4x/E9THWIrPaerQmHXZMK9qt3.SjoHqJEZJnNpxgIqLm	f	f	f	MAI
e08f4fb4-f7df-4224-9a81-21c0f93cf810	brook.allan.hoffman@gmail.com	Brook	Hoffman	\N	f	Jackson Chasers	2025-12-25 20:36:31.775562	2026-01-16 14:56:59.976	$2b$12$G6IjSFzikvdA5vcjU2FwaOtS/unvbnxbRQ4LvyN9Fvwkamdy5Vb9y	f	f	f	JAC
f335b9c3-7d63-44f3-9540-13b1d461ca13	mrmetal22@gmail.com	Larry	Hill	\N	f	El Monte Pythons	2025-12-25 20:36:30.922487	2026-01-17 03:59:44.413	$2b$12$2mSGa10fct1.kketD.Ae7uMLFW5QNQRVBhVraPMjppQpodortNEDq	f	f	f	EMP
d8be0952-18cc-4082-8a6c-5de14ea569ce	cullencmalone@gmail.com	Cullen	Malone	\N	f	South Florida Swordfish	2025-12-25 20:36:34.3482	2026-01-21 15:54:09.287	$2b$12$FGtXlq9d7we0j072..N/deRUnX9642vIsB7yqtDdDJlmJHZE1Op4i	f	f	f	SFS
cb2f8d01-d20e-4a3b-bbdf-65db57b9892d	polumral@yahoo.com	Ralph	Polumbo	\N	f	Electric City Bolts	2025-12-25 20:36:30.494065	2026-01-26 15:33:43.789	$2b$12$.AeAumPdXQRJSJoRyOPtVe20bEWfgbloU8yHj/2qXk8HqrhWTGyp.	f	f	f	ECB
\.


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE SET; Schema: _system; Owner: -
--

SELECT pg_catalog.setval('_system.replit_database_migrations_v1_id_seq', 6, true);


--
-- Name: auction_teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auction_teams_id_seq', 276, true);


--
-- Name: auctions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auctions_id_seq', 10, true);


--
-- Name: auto_bids_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auto_bids_id_seq', 345, true);


--
-- Name: bid_bundle_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bid_bundle_items_id_seq', 24, true);


--
-- Name: bid_bundles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bid_bundles_id_seq', 9, true);


--
-- Name: bids_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bids_id_seq', 2807, true);


--
-- Name: email_opt_outs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.email_opt_outs_id_seq', 1, true);


--
-- Name: free_agents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.free_agents_id_seq', 4848, true);


--
-- Name: league_members_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.league_members_id_seq', 30, true);


--
-- Name: leagues_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.leagues_id_seq', 2, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 46, true);


--
-- Name: roster_players_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.roster_players_id_seq', 1, false);


--
-- Name: replit_database_migrations_v1 replit_database_migrations_v1_pkey; Type: CONSTRAINT; Schema: _system; Owner: -
--

ALTER TABLE ONLY _system.replit_database_migrations_v1
    ADD CONSTRAINT replit_database_migrations_v1_pkey PRIMARY KEY (id);


--
-- Name: auction_teams auction_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_teams
    ADD CONSTRAINT auction_teams_pkey PRIMARY KEY (id);


--
-- Name: auctions auctions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auctions
    ADD CONSTRAINT auctions_pkey PRIMARY KEY (id);


--
-- Name: auto_bids auto_bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_bids
    ADD CONSTRAINT auto_bids_pkey PRIMARY KEY (id);


--
-- Name: bid_bundle_items bid_bundle_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundle_items
    ADD CONSTRAINT bid_bundle_items_pkey PRIMARY KEY (id);


--
-- Name: bid_bundles bid_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundles
    ADD CONSTRAINT bid_bundles_pkey PRIMARY KEY (id);


--
-- Name: bids bids_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_pkey PRIMARY KEY (id);


--
-- Name: email_opt_outs email_opt_outs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_opt_outs
    ADD CONSTRAINT email_opt_outs_pkey PRIMARY KEY (id);


--
-- Name: free_agents free_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_agents
    ADD CONSTRAINT free_agents_pkey PRIMARY KEY (id);


--
-- Name: league_members league_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_pkey PRIMARY KEY (id);


--
-- Name: league_settings league_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_settings
    ADD CONSTRAINT league_settings_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_slug_unique UNIQUE (slug);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_unique UNIQUE (token);


--
-- Name: roster_players roster_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_replit_database_migrations_v1_build_id; Type: INDEX; Schema: _system; Owner: -
--

CREATE UNIQUE INDEX idx_replit_database_migrations_v1_build_id ON _system.replit_database_migrations_v1 USING btree (build_id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: auction_teams auction_teams_auction_id_auctions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_teams
    ADD CONSTRAINT auction_teams_auction_id_auctions_id_fk FOREIGN KEY (auction_id) REFERENCES public.auctions(id);


--
-- Name: auction_teams auction_teams_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auction_teams
    ADD CONSTRAINT auction_teams_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: auctions auctions_created_by_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auctions
    ADD CONSTRAINT auctions_created_by_id_users_id_fk FOREIGN KEY (created_by_id) REFERENCES public.users(id);


--
-- Name: auctions auctions_league_id_leagues_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auctions
    ADD CONSTRAINT auctions_league_id_leagues_id_fk FOREIGN KEY (league_id) REFERENCES public.leagues(id);


--
-- Name: auto_bids auto_bids_free_agent_id_free_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_bids
    ADD CONSTRAINT auto_bids_free_agent_id_free_agents_id_fk FOREIGN KEY (free_agent_id) REFERENCES public.free_agents(id);


--
-- Name: auto_bids auto_bids_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auto_bids
    ADD CONSTRAINT auto_bids_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bid_bundle_items bid_bundle_items_bid_id_bids_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundle_items
    ADD CONSTRAINT bid_bundle_items_bid_id_bids_id_fk FOREIGN KEY (bid_id) REFERENCES public.bids(id);


--
-- Name: bid_bundle_items bid_bundle_items_bundle_id_bid_bundles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundle_items
    ADD CONSTRAINT bid_bundle_items_bundle_id_bid_bundles_id_fk FOREIGN KEY (bundle_id) REFERENCES public.bid_bundles(id);


--
-- Name: bid_bundle_items bid_bundle_items_free_agent_id_free_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundle_items
    ADD CONSTRAINT bid_bundle_items_free_agent_id_free_agents_id_fk FOREIGN KEY (free_agent_id) REFERENCES public.free_agents(id);


--
-- Name: bid_bundles bid_bundles_auction_id_auctions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundles
    ADD CONSTRAINT bid_bundles_auction_id_auctions_id_fk FOREIGN KEY (auction_id) REFERENCES public.auctions(id);


--
-- Name: bid_bundles bid_bundles_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bid_bundles
    ADD CONSTRAINT bid_bundles_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: bids bids_free_agent_id_free_agents_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_free_agent_id_free_agents_id_fk FOREIGN KEY (free_agent_id) REFERENCES public.free_agents(id);


--
-- Name: bids bids_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bids
    ADD CONSTRAINT bids_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_opt_outs email_opt_outs_auction_id_auctions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_opt_outs
    ADD CONSTRAINT email_opt_outs_auction_id_auctions_id_fk FOREIGN KEY (auction_id) REFERENCES public.auctions(id);


--
-- Name: email_opt_outs email_opt_outs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_opt_outs
    ADD CONSTRAINT email_opt_outs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: free_agents free_agents_auction_id_auctions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_agents
    ADD CONSTRAINT free_agents_auction_id_auctions_id_fk FOREIGN KEY (auction_id) REFERENCES public.auctions(id);


--
-- Name: free_agents free_agents_winner_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.free_agents
    ADD CONSTRAINT free_agents_winner_id_users_id_fk FOREIGN KEY (winner_id) REFERENCES public.users(id);


--
-- Name: league_members league_members_league_id_leagues_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_league_id_leagues_id_fk FOREIGN KEY (league_id) REFERENCES public.leagues(id);


--
-- Name: league_members league_members_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: roster_players roster_players_league_id_leagues_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_league_id_leagues_id_fk FOREIGN KEY (league_id) REFERENCES public.leagues(id);


--
-- Name: roster_players roster_players_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roster_players
    ADD CONSTRAINT roster_players_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict ARQxGO8jsBPzCKAXcCwPMoTjrYZvPzN76QGPMUIGk7fWxzKhjCTvx0FyqMIhbPe

