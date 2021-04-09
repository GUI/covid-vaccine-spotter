--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1
-- Dumped by pg_dump version 13.2

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
-- Name: audit; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA audit;


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry, geography, and raster spatial types and functions';


--
-- Name: audit_table(regclass); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass) RETURNS void
    LANGUAGE sql
    AS $_$
      SELECT audit.audit_table($1, BOOLEAN 't', BOOLEAN 't');
    $_$;


--
-- Name: audit_table(regclass, boolean, boolean); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean) RETURNS void
    LANGUAGE sql
    AS $_$
      SELECT audit.audit_table($1, $2, $3, ARRAY[]::TEXT[]);
    $_$;


--
-- Name: audit_table(regclass, boolean, boolean, text[]); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.audit_table(target_table regclass, audit_rows boolean, audit_query_text boolean, ignored_cols text[]) RETURNS void
    LANGUAGE plpgsql
    AS $$
    DECLARE
      stm_targets TEXT = 'INSERT OR UPDATE OR DELETE OR TRUNCATE';
      _q_txt TEXT;
      _ignored_cols_snip TEXT = '';
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_row ON ' || target_table::TEXT;
      EXECUTE 'DROP TRIGGER IF EXISTS audit_trigger_stm ON ' || target_table::TEXT;

      IF audit_rows THEN
        IF array_length(ignored_cols,1) > 0 THEN
            _ignored_cols_snip = ', ' || quote_literal(ignored_cols);
        END IF;
        _q_txt = 'CREATE TRIGGER audit_trigger_row '
                 'AFTER INSERT OR UPDATE OR DELETE ON ' ||
                 target_table::TEXT ||
                 ' FOR EACH ROW EXECUTE PROCEDURE audit.if_modified_func(' ||
                 quote_literal(audit_query_text) ||
                 _ignored_cols_snip ||
                 ');';
        RAISE NOTICE '%', _q_txt;
        EXECUTE _q_txt;
        stm_targets = 'TRUNCATE';
      END IF;

      _q_txt = 'CREATE TRIGGER audit_trigger_stm AFTER ' || stm_targets || ' ON ' ||
               target_table ||
               ' FOR EACH STATEMENT EXECUTE PROCEDURE audit.if_modified_func('||
               quote_literal(audit_query_text) || ');';
      RAISE NOTICE '%', _q_txt;
      EXECUTE _q_txt;
    END;
    $$;


--
-- Name: if_modified_func(); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.if_modified_func() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog', 'public'
    AS $$
    DECLARE
        audit_row audit.log;
        include_values BOOLEAN;
        log_diffs BOOLEAN;
        h_old JSONB;
        h_new JSONB;
        excluded_cols TEXT[] = ARRAY[]::TEXT[];
    BEGIN
      IF TG_WHEN <> 'AFTER' THEN
        RAISE EXCEPTION 'audit.if_modified_func() may only run as an AFTER trigger';
      END IF;

      audit_row = ROW(
        nextval('audit.log_id_seq'),                    -- id
        TG_TABLE_SCHEMA::TEXT,                          -- schema_name
        TG_TABLE_NAME::TEXT,                            -- table_name
        TG_RELID,                                       -- relation OID for faster searches
        session_user::TEXT,                             -- session_user_name
        current_user::TEXT,                             -- current_user_name
        current_timestamp,                              -- action_tstamp_tx
        statement_timestamp(),                          -- action_tstamp_stm
        clock_timestamp(),                              -- action_tstamp_clk
        txid_current(),                                 -- transaction ID
        current_setting('audit.application_name', true),      -- client application
        current_setting('audit.application_user_name', true), -- client user name
        inet_client_addr(),                             -- client_addr
        inet_client_port(),                             -- client_port
        current_query(),                                -- top-level query or queries
        substring(TG_OP, 1, 1),                         -- action
        NULL,                                           -- row_data
        NULL,                                           -- changed_fields
        'f'                                             -- statement_only
        );

      IF NOT TG_ARGV[0]::BOOLEAN IS DISTINCT FROM 'f'::BOOLEAN THEN
        audit_row.client_query = NULL;
      END IF;

      IF TG_ARGV[1] IS NOT NULL THEN
        excluded_cols = TG_ARGV[1]::TEXT[];
      END IF;

      IF (TG_OP = 'INSERT' AND TG_LEVEL = 'ROW') THEN
        audit_row.changed_fields = to_jsonb(NEW.*);
      ELSIF (TG_OP = 'UPDATE' AND TG_LEVEL = 'ROW') THEN
        audit_row.row_data = to_jsonb(OLD.*);
        audit_row.changed_fields =
          (to_jsonb(NEW.*) OPERATOR(audit.-) audit_row.row_data) OPERATOR(audit.-) excluded_cols;
        IF audit_row.changed_fields = '{}'::JSONB THEN
          -- All changed fields are ignored. Skip this update.
          RETURN NULL;
        END IF;
        audit_row.changed_fields =
          (to_jsonb(NEW.*) OPERATOR(audit.-) audit_row.row_data);
      ELSIF (TG_OP = 'DELETE' AND TG_LEVEL = 'ROW') THEN
        audit_row.row_data = to_jsonb(OLD.*);
      ELSIF (TG_LEVEL = 'STATEMENT' AND
             TG_OP IN ('INSERT','UPDATE','DELETE','TRUNCATE')) THEN
        audit_row.statement_only = 't';
      ELSE
        RAISE EXCEPTION '[audit.if_modified_func] - Trigger func added as trigger '
                        'for unhandled case: %, %', TG_OP, TG_LEVEL;
        RETURN NULL;
      END IF;
      INSERT INTO audit.log VALUES (audit_row.*);
      RETURN NULL;
    END;
    $$;


--
-- Name: jsonb_minus(jsonb, text[]); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.jsonb_minus("left" jsonb, keys text[]) RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      SELECT
        CASE
          WHEN "left" ?| "keys"
            THEN COALESCE(
              (SELECT ('{' ||
                        string_agg(to_json("key")::TEXT || ':' || "value", ',') ||
                        '}')
                 FROM jsonb_each("left")
                WHERE "key" <> ALL ("keys")),
              '{}'
            )::JSONB
          ELSE "left"
        END
    $$;


--
-- Name: jsonb_minus(jsonb, jsonb); Type: FUNCTION; Schema: audit; Owner: -
--

CREATE FUNCTION audit.jsonb_minus("left" jsonb, "right" jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      SELECT
        COALESCE(json_object_agg(
          "key",
          CASE
            -- if the value is an object and the value of the second argument is
            -- not null, we do a recursion
            WHEN jsonb_typeof("value") = 'object' AND "right" -> "key" IS NOT NULL
            THEN audit.jsonb_minus("value", "right" -> "key")
            -- for all the other types, we just return the value
            ELSE "value"
          END
        ), '{}')::JSONB
      FROM
        jsonb_each("left")
      WHERE
        "left" -> "key" <> "right" -> "key"
        OR "right" -> "key" IS NULL
    $$;


--
-- Name: make_rect_grid(public.geometry, double precision, double precision, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.make_rect_grid(geom public.geometry, height_meters double precision, width_meters double precision, use_envelope boolean DEFAULT false, OUT public.geometry) RETURNS SETOF public.geometry
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $_$ DECLARE
        x_max DECIMAL;
        y_max DECIMAL;
        x_min DECIMAL;
        y_min DECIMAL;
        srid INTEGER := 2163;
        input_srid INTEGER;
        x_series DECIMAL;
        y_series DECIMAL;
    BEGIN
      CASE public.st_srid ( geom ) WHEN 0 THEN
        geom := public.ST_SetSRID ( geom, srid );
        RAISE NOTICE'SRID Not Found.';
      ELSE
        RAISE NOTICE'SRID Found.';
      END CASE;
      input_srid := public.st_srid ( geom );
      geom := public.st_transform ( geom, srid );
        CASE use_envelope WHEN true THEN
          geom := public.st_envelope(geom);
            RAISE NOTICE'Using min/max for ST_Envelope on geom';
        ELSE
            RAISE NOTICE'Using min/max for geom';
        END CASE;
      x_max := public.ST_XMax ( geom );
      y_max := public.ST_YMax ( geom );
      x_min := public.ST_XMin ( geom );
      y_min := public.ST_YMin ( geom );
      x_series := ceil ( @( x_max - x_min ) / height_meters );
      y_series := ceil ( @( y_max - y_min ) / width_meters );
      RETURN QUERY
            WITH res AS (
                SELECT
                    public.st_collect (public.st_setsrid ( public.ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid )) AS grid
                FROM
                    generate_series ( 0, x_series ) AS j,
                    generate_series ( 0, y_series ) AS i,
                    (
                        SELECT ( 'POLYGON((0 0, 0 ' ||$3 || ', ' ||$2 || ' ' ||$3 || ', ' ||$2 || ' 0,0 0))' ) :: public.geometry AS cell
                    ) AS foo WHERE public.ST_Intersects ( public.st_setsrid ( public.ST_Translate ( cell, j * $2 + x_min, i * $3 + y_min ), srid ), geom )
        ) SELECT public.st_transform ( grid, input_srid ) FROM res;
    END;
    $_$;


--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
            BEGIN
              -- Detect changes using *<> operator which is compatible with "point"
              -- types that "DISTINCT FROM" is not:
              -- https://www.mail-archive.com/pgsql-general@postgresql.org/msg198866.html
              -- https://www.postgresql.org/docs/10/functions-comparisons.html#COMPOSITE-TYPE-COMPARISON
              IF NEW *<> OLD THEN
                NEW.updated_at := transaction_timestamp();
              END IF;

              RETURN NEW;
            END;
            $$;


--
-- Name: -; Type: OPERATOR; Schema: audit; Owner: -
--

CREATE OPERATOR audit.- (
    FUNCTION = audit.jsonb_minus,
    LEFTARG = jsonb,
    RIGHTARG = text[]
);


--
-- Name: -; Type: OPERATOR; Schema: audit; Owner: -
--

CREATE OPERATOR audit.- (
    FUNCTION = audit.jsonb_minus,
    LEFTARG = jsonb,
    RIGHTARG = jsonb
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: log; Type: TABLE; Schema: audit; Owner: -
--

CREATE TABLE audit.log (
    id bigint NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    relid oid NOT NULL,
    session_user_name text NOT NULL,
    current_user_name text NOT NULL,
    action_tstamp_tx timestamp with time zone NOT NULL,
    action_tstamp_stm timestamp with time zone NOT NULL,
    action_tstamp_clk timestamp with time zone NOT NULL,
    transaction_id bigint NOT NULL,
    application_name text,
    application_user_name text,
    client_addr inet,
    client_port integer,
    client_query text,
    action text NOT NULL,
    row_data jsonb,
    changed_fields jsonb,
    statement_only boolean NOT NULL,
    CONSTRAINT log_action_check CHECK ((action = ANY (ARRAY['I'::text, 'D'::text, 'U'::text, 'T'::text])))
);


--
-- Name: log_id_seq; Type: SEQUENCE; Schema: audit; Owner: -
--

CREATE SEQUENCE audit.log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: log_id_seq; Type: SEQUENCE OWNED BY; Schema: audit; Owner: -
--

ALTER SEQUENCE audit.log_id_seq OWNED BY audit.log.id;


--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    id character varying(255) NOT NULL,
    value jsonb
);


--
-- Name: country_grid_110km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_110km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_11km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_11km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_220km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_220km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_22km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_22km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_25km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_25km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: country_grid_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_grid_55km (
    id bigint NOT NULL,
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: knex_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_id_seq OWNED BY public.knex_migrations.id;


--
-- Name: knex_migrations_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knex_migrations_lock_index_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knex_migrations_lock_index_seq OWNED BY public.knex_migrations_lock.index;


--
-- Name: postal_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.postal_codes (
    id integer NOT NULL,
    state_code character varying(2) NOT NULL,
    postal_code character varying(5) NOT NULL,
    city character varying(255) NOT NULL,
    county_name character varying(255) NOT NULL,
    county_code character varying(255),
    location public.geography(Point,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    time_zone character varying(255)
);


--
-- Name: postal_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.postal_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: postal_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.postal_codes_id_seq OWNED BY public.postal_codes.id;


--
-- Name: provider_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_brands (
    id integer NOT NULL,
    provider_id character varying(255) NOT NULL,
    key character varying(255),
    name character varying(255),
    url character varying(255)
);


--
-- Name: provider_brands_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.provider_brands_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: provider_brands_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.provider_brands_id_seq OWNED BY public.provider_brands.id;


--
-- Name: providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.providers (
    id character varying(255) NOT NULL
);


--
-- Name: state_grid_110km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_110km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_11km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_11km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_220km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_220km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_22km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_22km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_500k_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_500k_55km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: state_grid_55km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.state_grid_55km (
    id bigint NOT NULL,
    state_code character varying(2),
    geom public.geometry,
    centroid_location public.geography,
    centroid_postal_code character varying(5),
    centroid_postal_code_state_code character varying(2),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id integer NOT NULL,
    country_code character varying(2) NOT NULL,
    code character varying(2) NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    boundaries public.geography(MultiPolygon,4326),
    boundaries_500k public.geography(MultiPolygon,4326),
    boundaries_5m public.geography(MultiPolygon,4326)
);


--
-- Name: states_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.states_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: states_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.states_id_seq OWNED BY public.states.id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    brand character varying(255) NOT NULL,
    brand_id character varying(255) NOT NULL,
    name character varying(255),
    address character varying(255),
    city character varying(255),
    state character varying(255),
    postal_code character varying(255),
    location public.geography(Point,4326),
    metadata_raw jsonb,
    carries_vaccine boolean,
    appointments jsonb,
    appointments_available boolean,
    appointments_last_fetched timestamp with time zone,
    appointments_raw jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    time_zone character varying(255),
    active boolean DEFAULT true NOT NULL,
    provider_id character varying(255),
    provider_location_id character varying(255),
    provider_brand_id integer,
    location_source character varying(255),
    url character varying(255),
    normalized_address_key character varying(255),
    appointment_types jsonb,
    appointment_vaccine_types jsonb,
    appointments_last_modified timestamp with time zone
);


--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- Name: walgreens_grid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.walgreens_grid (
    id integer NOT NULL,
    state_code character varying(2),
    geom public.geometry(MultiPolygon,4326),
    centroid_location public.geography(Point,4326),
    centroid_postal_code character varying(255),
    centroid_postal_code_state_code character varying(255),
    centroid_postal_code_city character varying(255),
    centroid_postal_code_county character varying(255),
    centroid_postal_code_location public.geography(Point,4326),
    centroid_land_location public.geography(Point,4326),
    grid_side_length integer,
    furthest_point numeric(8,2),
    point_count integer
);


--
-- Name: walgreens_grid_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.walgreens_grid_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: walgreens_grid_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.walgreens_grid_id_seq OWNED BY public.walgreens_grid.id;


--
-- Name: log id; Type: DEFAULT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.log ALTER COLUMN id SET DEFAULT nextval('audit.log_id_seq'::regclass);


--
-- Name: knex_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.knex_migrations_id_seq'::regclass);


--
-- Name: knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.knex_migrations_lock_index_seq'::regclass);


--
-- Name: postal_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes ALTER COLUMN id SET DEFAULT nextval('public.postal_codes_id_seq'::regclass);


--
-- Name: provider_brands id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands ALTER COLUMN id SET DEFAULT nextval('public.provider_brands_id_seq'::regclass);


--
-- Name: states id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states ALTER COLUMN id SET DEFAULT nextval('public.states_id_seq'::regclass);


--
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- Name: walgreens_grid id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.walgreens_grid ALTER COLUMN id SET DEFAULT nextval('public.walgreens_grid_id_seq'::regclass);


--
-- Name: log log_pkey; Type: CONSTRAINT; Schema: audit; Owner: -
--

ALTER TABLE ONLY audit.log
    ADD CONSTRAINT log_pkey PRIMARY KEY (id);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (id);


--
-- Name: country_grid_110km country_grid_110km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_110km
    ADD CONSTRAINT country_grid_110km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_11km country_grid_11km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_11km
    ADD CONSTRAINT country_grid_11km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_220km country_grid_220km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_220km
    ADD CONSTRAINT country_grid_220km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_22km country_grid_22km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_22km
    ADD CONSTRAINT country_grid_22km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_25km country_grid_25km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_25km
    ADD CONSTRAINT country_grid_25km_pkey PRIMARY KEY (id);


--
-- Name: country_grid_55km country_grid_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_grid_55km
    ADD CONSTRAINT country_grid_55km_pkey PRIMARY KEY (id);


--
-- Name: knex_migrations_lock knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations_lock
    ADD CONSTRAINT knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: knex_migrations knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knex_migrations
    ADD CONSTRAINT knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: postal_codes postal_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_pkey PRIMARY KEY (id);


--
-- Name: postal_codes postal_codes_postal_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_postal_code_unique UNIQUE (postal_code);


--
-- Name: provider_brands provider_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_pkey PRIMARY KEY (id);


--
-- Name: provider_brands provider_brands_provider_id_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_provider_id_key_unique UNIQUE (provider_id, key);


--
-- Name: providers providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.providers
    ADD CONSTRAINT providers_pkey PRIMARY KEY (id);


--
-- Name: state_grid_110km state_grid_110km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_110km
    ADD CONSTRAINT state_grid_110km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_11km state_grid_11km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_11km
    ADD CONSTRAINT state_grid_11km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_220km state_grid_220km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_220km
    ADD CONSTRAINT state_grid_220km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_22km state_grid_22km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_22km
    ADD CONSTRAINT state_grid_22km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_500k_55km state_grid_500k_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_500k_55km
    ADD CONSTRAINT state_grid_500k_55km_pkey PRIMARY KEY (id);


--
-- Name: state_grid_55km state_grid_55km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.state_grid_55km
    ADD CONSTRAINT state_grid_55km_pkey PRIMARY KEY (id);


--
-- Name: states states_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_code_unique UNIQUE (code);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: stores stores_brand_brand_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_brand_brand_id_unique UNIQUE (brand, brand_id);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: stores stores_provider_id_normalized_address_key_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_normalized_address_key_unique UNIQUE (provider_id, normalized_address_key);


--
-- Name: stores stores_provider_id_provider_location_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_provider_location_id_unique UNIQUE (provider_id, provider_location_id);


--
-- Name: walgreens_grid walgreens_grid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.walgreens_grid
    ADD CONSTRAINT walgreens_grid_pkey PRIMARY KEY (id);


--
-- Name: log_action_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_action_idx ON audit.log USING btree (action);


--
-- Name: log_action_tstamp_tx_stm_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_action_tstamp_tx_stm_idx ON audit.log USING btree (action_tstamp_stm);


--
-- Name: log_relid_idx; Type: INDEX; Schema: audit; Owner: -
--

CREATE INDEX log_relid_idx ON audit.log USING btree (relid);


--
-- Name: country_grid_110km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_110km_centroid_location_index ON public.country_grid_110km USING gist (centroid_location);


--
-- Name: country_grid_110km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_110km_geom_index ON public.country_grid_110km USING gist (geom);


--
-- Name: country_grid_11km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_11km_centroid_location_index ON public.country_grid_11km USING gist (centroid_location);


--
-- Name: country_grid_11km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_11km_geom_index ON public.country_grid_11km USING gist (geom);


--
-- Name: country_grid_220km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_220km_centroid_location_index ON public.country_grid_220km USING gist (centroid_location);


--
-- Name: country_grid_220km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_220km_geom_index ON public.country_grid_220km USING gist (geom);


--
-- Name: country_grid_22km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_22km_centroid_location_index ON public.country_grid_22km USING gist (centroid_location);


--
-- Name: country_grid_22km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_22km_geom_index ON public.country_grid_22km USING gist (geom);


--
-- Name: country_grid_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_55km_centroid_location_index ON public.country_grid_55km USING gist (centroid_location);


--
-- Name: country_grid_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX country_grid_55km_geom_index ON public.country_grid_55km USING gist (geom);


--
-- Name: postal_codes_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_location_index ON public.postal_codes USING gist (location);


--
-- Name: postal_codes_postal_code_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX postal_codes_postal_code_index ON public.postal_codes USING btree (postal_code);


--
-- Name: state_grid_110km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_110km_centroid_location_index ON public.state_grid_110km USING gist (centroid_location);


--
-- Name: state_grid_110km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_110km_geom_index ON public.state_grid_110km USING gist (geom);


--
-- Name: state_grid_11km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_11km_centroid_location_index ON public.state_grid_11km USING gist (centroid_location);


--
-- Name: state_grid_11km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_11km_geom_index ON public.state_grid_11km USING gist (geom);


--
-- Name: state_grid_220km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_220km_centroid_location_index ON public.state_grid_220km USING gist (centroid_location);


--
-- Name: state_grid_220km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_220km_geom_index ON public.state_grid_220km USING gist (geom);


--
-- Name: state_grid_22km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_22km_centroid_location_index ON public.state_grid_22km USING gist (centroid_location);


--
-- Name: state_grid_22km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_22km_geom_index ON public.state_grid_22km USING gist (geom);


--
-- Name: state_grid_500k_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_500k_55km_centroid_location_index ON public.state_grid_500k_55km USING gist (centroid_location);


--
-- Name: state_grid_500k_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_500k_55km_geom_index ON public.state_grid_500k_55km USING gist (geom);


--
-- Name: state_grid_55km_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_55km_centroid_location_index ON public.state_grid_55km USING gist (centroid_location);


--
-- Name: state_grid_55km_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX state_grid_55km_geom_index ON public.state_grid_55km USING gist (geom);


--
-- Name: states_boundaries_500k_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_500k_index ON public.states USING gist (boundaries_500k);


--
-- Name: states_boundaries_5m_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_5m_index ON public.states USING gist (boundaries_5m);


--
-- Name: states_boundaries_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_boundaries_index ON public.states USING gist (boundaries);


--
-- Name: stores_appointments_available_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_appointments_available_index ON public.stores USING btree (appointments_available);


--
-- Name: stores_appointments_last_fetched_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_appointments_last_fetched_index ON public.stores USING btree (appointments_last_fetched);


--
-- Name: stores_carries_vaccine_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_carries_vaccine_index ON public.stores USING btree (carries_vaccine);


--
-- Name: stores_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_location_index ON public.stores USING gist (location);


--
-- Name: stores_provider_id_carries_vaccine_appointments_last_fetche_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_provider_id_carries_vaccine_appointments_last_fetche_idx ON public.stores USING btree (provider_id, carries_vaccine, appointments_last_fetched);


--
-- Name: stores_state_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stores_state_index ON public.stores USING btree (state);


--
-- Name: walgreens_grid_centroid_land_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_centroid_land_location_index ON public.walgreens_grid USING gist (centroid_land_location);


--
-- Name: walgreens_grid_centroid_location_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_centroid_location_index ON public.walgreens_grid USING gist (centroid_location);


--
-- Name: walgreens_grid_geom_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_geom_index ON public.walgreens_grid USING gist (geom);


--
-- Name: walgreens_grid_state_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX walgreens_grid_state_code_idx ON public.walgreens_grid USING btree (state_code);


--
-- Name: stores audit_trigger_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger_row AFTER INSERT OR DELETE OR UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION audit.if_modified_func('false', '{created_at,updated_at,metadata_raw,appointments_raw,appointments_last_fetched}');


--
-- Name: stores audit_trigger_stm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_trigger_stm AFTER TRUNCATE ON public.stores FOR EACH STATEMENT EXECUTE FUNCTION audit.if_modified_func('false');


--
-- Name: postal_codes postal_codes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER postal_codes_updated_at BEFORE UPDATE ON public.postal_codes FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: states states_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER states_updated_at BEFORE UPDATE ON public.states FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: stores stores_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: postal_codes postal_codes_state_code_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.postal_codes
    ADD CONSTRAINT postal_codes_state_code_foreign FOREIGN KEY (state_code) REFERENCES public.states(code);


--
-- Name: provider_brands provider_brands_provider_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_brands
    ADD CONSTRAINT provider_brands_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: stores stores_postal_code_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_postal_code_foreign FOREIGN KEY (postal_code) REFERENCES public.postal_codes(postal_code);


--
-- Name: stores stores_provider_brand_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_brand_id_foreign FOREIGN KEY (provider_brand_id) REFERENCES public.provider_brands(id);


--
-- Name: stores stores_provider_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_provider_id_foreign FOREIGN KEY (provider_id) REFERENCES public.providers(id);


--
-- Name: stores stores_state_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_state_foreign FOREIGN KEY (state) REFERENCES public.states(code);


--
-- PostgreSQL database dump complete
--



--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1
-- Dumped by pg_dump version 13.2

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
-- Data for Name: knex_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.knex_migrations (id, name, batch, migration_time) FROM stdin;
16	20210221100547_create_states.js	1	2021-02-21 21:25:21.993+00
17	20210221100553_create_postal_codes.js	1	2021-02-21 21:25:22.33+00
24	20210221143355_create_stores.js	2	2021-02-22 04:41:43.631+00
25	20210222161552_optional_store_location.js	3	2021-02-22 23:20:50.858+00
29	20210223095007_state_boundaries.js	4	2021-02-23 23:58:05.058+00
30	20210223173502_store_time_zone.js	5	2021-02-24 00:38:23.872+00
31	20210223232431_optional_store_city_state.js	6	2021-02-24 06:26:37.028+00
36	20210225081423_country_grids.js	7	2021-02-26 00:19:36.812+00
40	20210226081756_audit.js	8	2021-02-26 15:42:10.901+00
41	20210227104231_postal_code_time_zone.js	9	2021-02-27 18:12:56.473+00
45	20210301091717_smaller_country_grids.js	10	2021-03-03 05:46:46.508+00
46	20210302161153_bigger_country_grid.js	10	2021-03-03 05:46:50.622+00
51	20210304151335_provider_brand.js	11	2021-03-05 02:51:44.143+00
52	20210307114320_geocoding.js	12	2021-03-07 18:46:53.196+00
53	20210307171239_store_url.js	13	2021-03-08 00:20:37.33+00
56	20210315165140_store_normalized_address_key.js	14	2021-03-16 03:50:20.785+00
61	20210322161258_walgreens_grid.js	15	2021-03-23 05:49:27.875+00
63	20210324142039_store_vaccine_appointment_types.js	16	2021-03-24 20:53:32.342+00
65	20210325091544_create_cache.js	17	2021-03-25 15:29:23.505+00
67	20210329150722_states_boundaries_500k.js	18	2021-03-29 21:51:36.984+00
69	20210329160409_create_state_grid_55km_500k.js	19	2021-03-29 22:57:20.879+00
70	20210401101728_appointments_last_modified.js	20	2021-04-01 16:19:52.884+00
73	20210408224048_convert_materialized_views.js	21	2021-04-09 05:07:41.373+00
\.


--
-- Name: knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.knex_migrations_id_seq', 73, true);


--
-- PostgreSQL database dump complete
--
